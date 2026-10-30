import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateRecipientKeyPair,
  serializePublicKey,
} from "@keeplas/crypto/kem";
import { generateIdentityKeyPair } from "@keeplas/crypto/sig";
import {
  approveRecovery,
  createSocialRecovery,
  newRecoveryNonce,
  openSocialRecovery,
  recoveryCode,
  recoveryCommitment,
} from "@keeplas/crypto/social";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { RECOVERY_REQUEST_TTL_MS, RECOVERY_WINDOW_MS } from "../recovery";
import {
  asPhoneProvenUser,
  asUser,
  asUserSession,
  makeT,
  seedSession,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

// Phase 5 (F3, D3, D4): owner recovery with trust contacts. Real crypto on
// every side; Convex only relays sealed shares and holds G under KMS.
//   pending → approved_1 → approved_2 → released → rotated
//   cancel · reject · expire

type Contact = {
  userId: Id<"users">;
  contactId: Id<"trusted_contacts">;
  kem: ReturnType<typeof generateRecipientKeyPair>;
  identity: ReturnType<typeof generateIdentityKeyPair>;
};

async function seedContact(
  t: TestConvex,
  ownerId: Id<"users">,
  n: number,
): Promise<Contact> {
  const kem = generateRecipientKeyPair();
  const identity = generateIdentityKeyPair();
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name: `Contact ${n}` }),
  );
  const now = Date.now();
  const contactId = await t.run((ctx) =>
    ctx.db.insert("trusted_contacts", {
      userId: ownerId,
      contactUserId: userId,
      name: `Contact ${n}`,
      email: `c${n}@example.com`,
      role: "friend",
      invitationStatus: "accepted",
      invitationToken: `tok-${n}`,
      invitedAt: now,
      contactPublicKey: serializePublicKey(kem.publicKey),
      contactIdentityPublicKey: identity.publicKey,
      createdAt: now,
      updatedAt: now,
    }),
  );
  return { userId, contactId, kem, identity };
}

async function setupOwner(t: TestConvex, contactCount = 3) {
  const ownerId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Alex" }),
  );
  const contacts: Contact[] = [];
  for (let i = 0; i < contactCount; i++) {
    contacts.push(await seedContact(t, ownerId, i));
  }
  const masterKey = crypto.getRandomValues(new Uint8Array(32));
  const owner = asUser(t, ownerId);
  const targets = await owner.query(api.recovery.getSetupTargets, {});
  const setup = await createSocialRecovery({
    masterKey,
    userId: ownerId,
    generation: targets.nextGeneration,
    contacts: targets.contacts,
  });
  await owner.action(api.recovery_node.setup, {
    generation: setup.generation,
    socialEnvelope: setup.socialEnvelope,
    shares: setup.shares as {
      contactId: Id<"trusted_contacts">;
      wrappedShare: string;
    }[],
    gateKey: setup.gateKey,
    _audit: await signedAudit(),
  });
  return { ownerId, owner, contacts, masterKey };
}

type Device = Awaited<ReturnType<typeof openRequest>>;

/** New device, as an app without code commitments did (legacy shape). */
async function openRequest(t: TestConvex, ownerId: Id<"users">) {
  const device = generateRecipientKeyPair();
  const devicePublicKey = serializePublicKey(device.publicKey);
  const newDevice = await asPhoneProvenUser(t, ownerId);
  const requestId = await newDevice.mutation(api.recovery.start, {
    newDevicePublicKey: devicePublicKey,
    _audit: await signedAudit(),
  });
  // What the device keeps locally: one secret nonce per contact.
  const nonces = new Map<string, string>();
  const commitCodes = async () => {
    const mine = (await newDevice.query(api.recovery.getMyRequest, {}))!;
    const commitments = [];
    for (const contact of mine.contacts) {
      const nonce = newRecoveryNonce();
      nonces.set(contact.contactId, nonce);
      commitments.push({
        contactId: contact.contactId,
        commitment: await recoveryCommitment(devicePublicKey, nonce),
      });
    }
    await newDevice.mutation(api.recovery.commitCodes, {
      requestId,
      commitments,
      _audit: await signedAudit(),
    });
  };
  const reveal = async (contactId: Id<"trusted_contacts">) =>
    newDevice.mutation(api.recovery.revealCode, {
      requestId,
      contactId,
      deviceNonce: nonces.get(contactId)!,
      _audit: await signedAudit(),
    });
  return {
    requestId,
    device,
    devicePublicKey,
    newDevice,
    nonces,
    commitCodes,
    reveal,
  };
}

/** New device, current app: opens the request and commits the codes. */
async function startRequest(t: TestConvex, ownerId: Id<"users">) {
  const request = await openRequest(t, ownerId);
  await request.commitCodes();
  return request;
}

/**
 * Contact answers with its nonce, the device reveals, both compute the code
 * (they must match), then the contact seals its share to the device key.
 */
async function contactApproves(
  t: TestConvex,
  ownerId: Id<"users">,
  contact: Contact,
  device: Device,
) {
  const as = asUser(t, contact.userId);
  const [seen] = await as.query(api.recovery.getRequestsForMe, {});
  const contactNonce = newRecoveryNonce();
  await as.mutation(api.recovery.sendCodeNonce, {
    requestId: seen.requestId,
    contactNonce,
    _audit: await signedAudit(),
  });
  await device.reveal(seen.contactId);
  const [pending] = await as.query(api.recovery.getRequestsForMe, {});
  const code = await recoveryCode({
    requestId: pending.requestId,
    contactId: pending.contactId,
    devicePublicKey: pending.newDevicePublicKey,
    commitment: seen.commitment!,
    deviceNonce: pending.deviceNonce!,
    contactNonce,
  });
  const mine = (await device.newDevice.query(api.recovery.getMyRequest, {}))!;
  const slot = mine.contacts.find((c) => c.contactId === seen.contactId)!;
  expect(
    await recoveryCode({
      requestId: device.requestId,
      contactId: seen.contactId,
      devicePublicKey: device.devicePublicKey,
      commitment: slot.commitment!,
      deviceNonce: device.nonces.get(seen.contactId)!,
      contactNonce: slot.contactNonce!,
    }),
  ).toBe(code);
  const approval = await approveRecovery({
    wrappedShare: pending.wrappedShare,
    contactSecretKey: contact.kem.secretKey,
    contactIdentitySecretKey: contact.identity.secretKey,
    ownerUserId: ownerId,
    contactId: pending.contactId,
    generation: pending.generation,
    requestId: pending.requestId,
    devicePublicKey: pending.newDevicePublicKey,
  });
  await as.mutation(api.recovery.approve, {
    requestId: pending.requestId,
    ...approval,
    _audit: await signedAudit(),
  });
}

async function statusOf(t: TestConvex, id: Id<"recovery_requests">) {
  return (await t.run((ctx) => ctx.db.get(id)))?.status;
}

describe("owner recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.GATE_KEY_KMS = "local";
    process.env.GATE_KEY_LOCAL_KEK = Buffer.alloc(32, 9).toString("base64");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("goes pending → approved_1 → approved_2 → released → rotated and restores the MasterKey", async () => {
    const t = makeT();
    const { ownerId, contacts, masterKey } = await setupOwner(t);
    const request = await startRequest(t, ownerId);
    const { requestId, device, devicePublicKey, newDevice } = request;
    expect(await statusOf(t, requestId)).toBe("pending");

    // Both sides compute the same code locally (D4), in contactApproves.
    await contactApproves(t, ownerId, contacts[0], request);
    expect(await statusOf(t, requestId)).toBe("approved_1");
    await contactApproves(t, ownerId, contacts[2], request);
    expect(await statusOf(t, requestId)).toBe("approved_2");

    // Nothing is released before the 72 h window.
    expect(await t.action(internal.recovery_node.release, { requestId })).toBe(
      false,
    );
    expect(
      await newDevice.query(api.recovery.getReleasePackage, { requestId }),
    ).toBeNull();

    vi.advanceTimersByTime(RECOVERY_WINDOW_MS);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await statusOf(t, requestId)).toBe("released");

    const pkg = (await newDevice.query(api.recovery.getReleasePackage, {
      requestId,
    }))!;
    const restored = await openSocialRecovery({
      ownerUserId: ownerId,
      generation: pkg.generation,
      requestId,
      devicePublicKey,
      deviceSecretKey: device.secretKey,
      wrappedGateKey: pkg.wrappedGateKey,
      socialEnvelope: pkg.socialEnvelope,
      approvals: pkg.approvals,
    });
    expect(restored).toEqual(masterKey);

    // Renewal on the new device closes the request and replaces RS and G.
    const targets = await newDevice.query(api.recovery.getSetupTargets, {});
    const renewed = await createSocialRecovery({
      masterKey: restored,
      userId: ownerId,
      generation: targets.nextGeneration,
      contacts: targets.contacts,
    });
    await newDevice.action(api.recovery_node.setup, {
      generation: renewed.generation,
      socialEnvelope: renewed.socialEnvelope,
      shares: renewed.shares as {
        contactId: Id<"trusted_contacts">;
        wrappedShare: string;
      }[],
      gateKey: renewed.gateKey,
      completesRequestId: requestId,
      _audit: await signedAudit(),
    });
    expect(await statusOf(t, requestId)).toBe("rotated");
    const rows = await t.run(async (ctx) => ({
      shares: await ctx.db.query("recovery_secret_shares").collect(),
      gates: await ctx.db.query("gate_keys").collect(),
      request: await ctx.db.get(requestId),
    }));
    expect(new Set(rows.shares.map((s) => s.generation))).toEqual(new Set([2]));
    expect(rows.gates.map((g) => g.generation)).toEqual([2]);
    expect(rows.request?.wrappedGateKey).toBeUndefined();
  });

  it("stores G only under KMS, never in clear", async () => {
    const t = makeT();
    await setupOwner(t);
    const gates = await t.run((ctx) => ctx.db.query("gate_keys").collect());
    expect(gates).toHaveLength(1);
    expect(gates[0].kmsCiphertext).toMatch(/^local:v1:/);
  });

  it("releases at once when the 2nd approval comes after the window", async () => {
    const t = makeT();
    const { ownerId, contacts } = await setupOwner(t);
    const request = await startRequest(t, ownerId);
    const { requestId } = request;
    await contactApproves(t, ownerId, contacts[0], request);
    vi.advanceTimersByTime(RECOVERY_WINDOW_MS + 1);
    expect(await statusOf(t, requestId)).toBe("approved_1");
    await contactApproves(t, ownerId, contacts[1], request);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await statusOf(t, requestId)).toBe("released");
  });

  // Each start alerts every contact on WhatsApp and email: a start → cancel
  // loop must not turn the contacts' channels into a spam relay.
  it("caps how many requests an account starts per day", async () => {
    const t = makeT();
    const { ownerId, owner } = await setupOwner(t);
    for (let i = 0; i < 3; i++) {
      await openRequest(t, ownerId);
      await owner.mutation(api.recovery.cancel, {
        _audit: await signedAudit(),
      });
    }

    await expect(openRequest(t, ownerId)).rejects.toThrow("Too many requests");
  });

  it("cancel from any owner device stops the release and requires a renewal", async () => {
    const t = makeT();
    const { ownerId, owner, contacts } = await setupOwner(t);
    const request = await startRequest(t, ownerId);
    const { requestId } = request;
    await contactApproves(t, ownerId, contacts[0], request);
    await contactApproves(t, ownerId, contacts[1], request);
    await owner.mutation(api.recovery.cancel, { _audit: await signedAudit() });
    expect(await statusOf(t, requestId)).toBe("cancelled");

    vi.advanceTimersByTime(RECOVERY_WINDOW_MS);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await statusOf(t, requestId)).toBe("cancelled");
    const user = await t.run((ctx) => ctx.db.get(ownerId));
    expect(user?.socialRecoveryRenewalRequired).toBe(true);
    const health = await owner.query(api.recovery.getHealth, {});
    expect(health?.trustContacts.renewalRequired).toBe(true);
  });

  it("'It wasn't me' cancels a recovery in progress", async () => {
    const t = makeT();
    const { ownerId } = await setupOwner(t);
    const { requestId } = await startRequest(t, ownerId);
    const phoneSession = await seedSession(t, ownerId);
    const phone = asUserSession(t, ownerId, phoneSession);
    const browserSession = await seedSession(t, ownerId);
    const browserId = await t.run((ctx) =>
      ctx.db.insert("devices", {
        userId: ownerId,
        kind: "web",
        label: "Chrome",
        trusted: false,
        sessionId: browserSession,
        lastSeenAt: 0,
        createdAt: 0,
      }),
    );
    const result = await phone.mutation(api.devices.notMe, {
      deviceId: browserId,
      _audit: await signedAudit(),
    });
    expect(result.recoveryCancelled).toBe(true);
    expect(await statusOf(t, requestId)).toBe("cancelled");
  });

  it("a contact's refusal or code mismatch rejects the request (M09-5)", async () => {
    const t = makeT();
    const { ownerId, owner, contacts } = await setupOwner(t);
    const request = await startRequest(t, ownerId);
    const { requestId } = request;
    await asUser(t, contacts[1].userId).mutation(api.recovery.reject, {
      requestId,
      reason: "code_mismatch",
      _audit: await signedAudit(),
    });
    expect(await statusOf(t, requestId)).toBe("rejected");
    const mine = await owner.query(api.recovery.getMyRequest, {});
    expect(
      mine?.contacts.find((c) => c.contactId === contacts[1].contactId),
    ).toMatchObject({ decision: "reject", rejectReason: "code_mismatch" });
    await expect(
      contactApproves(t, ownerId, contacts[0], request),
    ).rejects.toThrow();
  });

  it("expires after 7 days without 2 approvals", async () => {
    const t = makeT();
    const { ownerId, contacts } = await setupOwner(t);
    const request = await startRequest(t, ownerId);
    const { requestId } = request;
    await contactApproves(t, ownerId, contacts[0], request);
    vi.advanceTimersByTime(RECOVERY_REQUEST_TTL_MS);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await statusOf(t, requestId)).toBe("expired");
  });

  it("seals a recovery share to every accepted contact, not just 3", async () => {
    const t = makeT();
    const { ownerId } = await setupOwner(t, 5);
    const shares = await t.run((ctx) =>
      ctx.db
        .query("recovery_secret_shares")
        .withIndex("by_user_generation", (q) =>
          q.eq("userId", ownerId).eq("generation", 1),
        )
        .collect(),
    );
    expect(shares).toHaveLength(5);
  });

  it("setup targets carry what verify-before-seal needs", async () => {
    const t = makeT();
    const { owner, contacts } = await setupOwner(t, 2);
    await t.run((ctx) =>
      ctx.db.patch(contacts[0].contactId, {
        pinnedIdentityFingerprint: "fp",
        pinnedIdentityMac: "mac",
      }),
    );
    const { contacts: targets } = await owner.query(
      api.recovery.getSetupTargets,
      {},
    );
    expect(targets.map((c) => c.contactUserId).sort()).toEqual(
      contacts.map((c) => c.userId).sort(),
    );
    expect(
      targets.find((c) => c.contactId === contacts[0].contactId)
        ?.pinnedIdentityMac,
    ).toBe("mac");
    // Shares are sealed now: a missing pin is not a first use any more.
    expect(targets.every((c) => c.hasWraps)).toBe(true);
  });

  it("refuses a request with fewer than 2 contacts set up (M09-6)", async () => {
    const t = makeT();
    const ownerId = await t.run((ctx) => ctx.db.insert("users", {}));
    await expect(startRequest(t, ownerId)).rejects.toThrow(
      "FEWER_THAN_2_CONTACTS",
    );
  });

  it("allows one request at a time and one answer per contact", async () => {
    const t = makeT();
    const { ownerId, contacts } = await setupOwner(t);
    const request = await startRequest(t, ownerId);
    await expect(startRequest(t, ownerId)).rejects.toThrow(
      "already in progress",
    );
    await contactApproves(t, ownerId, contacts[0], request);
    // The request no longer shows up for a contact who answered.
    expect(
      await asUser(t, contacts[0].userId).query(
        api.recovery.getRequestsForMe,
        {},
      ),
    ).toEqual([]);
  });

  it("refuses an approval before the device revealed the code nonce", async () => {
    const t = makeT();
    const { ownerId, contacts } = await setupOwner(t);
    const { requestId } = await startRequest(t, ownerId);
    const as = asUser(t, contacts[0].userId);
    const [pending] = await as.query(api.recovery.getRequestsForMe, {});
    const approval = await approveRecovery({
      wrappedShare: pending.wrappedShare,
      contactSecretKey: contacts[0].kem.secretKey,
      contactIdentitySecretKey: contacts[0].identity.secretKey,
      ownerUserId: ownerId,
      contactId: pending.contactId,
      generation: pending.generation,
      requestId,
      devicePublicKey: pending.newDevicePublicKey,
    });
    await expect(
      as.mutation(api.recovery.approve, {
        requestId,
        ...approval,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("RECOVERY_CODE_NOT_COMPARED");
  });

  it("keeps every code value write-once, in order", async () => {
    const t = makeT();
    const { ownerId, contacts } = await setupOwner(t);
    const request = await startRequest(t, ownerId);
    const contactId = contacts[0].contactId;
    // The device reveals only after the contact answered.
    await expect(request.reveal(contactId)).rejects.toThrow(
      "RECOVERY_CODE_NOT_ANSWERED",
    );
    const as = asUser(t, contacts[0].userId);
    const contactNonce = newRecoveryNonce();
    const answer = async (nonce: string) =>
      as.mutation(api.recovery.sendCodeNonce, {
        requestId: request.requestId,
        contactNonce: nonce,
        _audit: await signedAudit(),
      });
    await answer(contactNonce);
    await answer(contactNonce); // A retry is a no-op.
    await expect(answer(newRecoveryNonce())).rejects.toThrow("already set");
    await request.reveal(contactId);
    await request.reveal(contactId);
    await expect(
      request.newDevice.mutation(api.recovery.revealCode, {
        requestId: request.requestId,
        contactId,
        deviceNonce: newRecoveryNonce(),
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("already set");
    // A commitment cannot be replaced either.
    await expect(request.commitCodes()).rejects.toThrow("already set");
  });

  it("lets only the owner's phone-proven session commit and reveal", async () => {
    const t = makeT();
    const { ownerId, owner, contacts } = await setupOwner(t);
    const request = await openRequest(t, ownerId);
    const commitments = [
      {
        contactId: contacts[0].contactId,
        commitment: await recoveryCommitment(
          request.devicePublicKey,
          newRecoveryNonce(),
        ),
      },
    ];
    await expect(
      owner.mutation(api.recovery.commitCodes, {
        requestId: request.requestId,
        commitments,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("PHONE_PROOF_REQUIRED");
    const stranger = await asPhoneProvenUser(
      t,
      await t.run((ctx) => ctx.db.insert("users", {})),
    );
    await expect(
      stranger.mutation(api.recovery.commitCodes, {
        requestId: request.requestId,
        commitments,
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("Unknown recovery request");
  });

  it("upgrades a request opened before code commitments (legacy)", async () => {
    const t = makeT();
    const { ownerId, contacts, masterKey } = await setupOwner(t);
    const legacy = await openRequest(t, ownerId);
    // Contact 0 approved with the old code before the upgrade shipped.
    const [old] = await asUser(t, contacts[0].userId).query(
      api.recovery.getRequestsForMe,
      {},
    );
    const oldApproval = await approveRecovery({
      wrappedShare: old.wrappedShare,
      contactSecretKey: contacts[0].kem.secretKey,
      contactIdentitySecretKey: contacts[0].identity.secretKey,
      ownerUserId: ownerId,
      contactId: old.contactId,
      generation: old.generation,
      requestId: legacy.requestId,
      devicePublicKey: legacy.devicePublicKey,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("recovery_approvals", {
        requestId: legacy.requestId,
        contactId: contacts[0].contactId,
        decision: "approve",
        ...oldApproval,
        createdAt: Date.now(),
      });
      await ctx.db.patch(legacy.requestId, { status: "approved_1" });
    });

    // No commitment yet: contact 1 sees the request but cannot answer.
    const contact1 = asUser(t, contacts[1].userId);
    const [seen] = await contact1.query(api.recovery.getRequestsForMe, {});
    expect(seen.commitment).toBeNull();
    await expect(
      contact1.mutation(api.recovery.sendCodeNonce, {
        requestId: legacy.requestId,
        contactNonce: newRecoveryNonce(),
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("RECOVERY_CODE_NOT_COMMITTED");

    // The updated device app commits when it opens; the request completes.
    await legacy.commitCodes();
    await contactApproves(t, ownerId, contacts[1], legacy);
    expect(await statusOf(t, legacy.requestId)).toBe("approved_2");
    vi.advanceTimersByTime(RECOVERY_WINDOW_MS);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const pkg = (await legacy.newDevice.query(api.recovery.getReleasePackage, {
      requestId: legacy.requestId,
    }))!;
    expect(
      await openSocialRecovery({
        ownerUserId: ownerId,
        generation: pkg.generation,
        requestId: legacy.requestId,
        devicePublicKey: legacy.devicePublicKey,
        deviceSecretKey: legacy.device.secretKey,
        wrappedGateKey: pkg.wrappedGateKey,
        socialEnvelope: pkg.socialEnvelope,
        approvals: pkg.approvals,
      }),
    ).toEqual(masterKey);
  });

  it("refuses an approval from someone who is not a trust contact", async () => {
    const t = makeT();
    const { ownerId } = await setupOwner(t);
    const { requestId } = await startRequest(t, ownerId);
    const stranger = await t.run((ctx) => ctx.db.insert("users", {}));
    await expect(
      asUser(t, stranger).mutation(api.recovery.approve, {
        requestId,
        wrappedShareForDevice: "x",
        signature: "y",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("not a trust contact");
  });

  it("a MasterKey rotation requires a renewal of the recovery material", async () => {
    const t = makeT();
    const { ownerId, owner } = await setupOwner(t);
    await owner.mutation(api.rotation.finalizeRotation, {
      _audit: await signedAudit(),
    });
    const user = await t.run((ctx) => ctx.db.get(ownerId));
    expect(user?.socialRecoveryRenewalRequired).toBe(true);
  });

  it("reports a single way back in (M09-10)", async () => {
    const t = makeT();
    const ownerId = await t.run((ctx) =>
      ctx.db.insert("users", { recoveryVerified: true }),
    );
    expect(await asUser(t, ownerId).query(api.recovery.getHealth, {})).toEqual({
      trustContacts: {
        configured: false,
        contactCount: 0,
        eligibleCount: 0,
        renewalRequired: false,
      },
      recoveryKit: true,
      activeDevices: 0,
    });
  });

  it("says contacts can help only once their recovery is sealed", async () => {
    const t = makeT();
    const unsealedId = await t.run((ctx) => ctx.db.insert("users", {}));
    await seedContact(t, unsealedId, 10);
    await seedContact(t, unsealedId, 11);
    expect(
      await asUser(t, unsealedId).query(
        api.trusted_contacts.getContactsReady,
        {},
      ),
    ).toBe(false);

    const { owner } = await setupOwner(t, 2);
    expect(await owner.query(api.trusted_contacts.getContactsReady, {})).toBe(
      true,
    );
  });
});

// Finding 36: setup used to reach the KMS before any step-up / audit check
// and without a limit, and a failed KMS call stranded a recovery for good.
describe("recovery_node hardening", () => {
  const gateKey = Buffer.alloc(32, 1).toString("base64");

  beforeEach(() => {
    vi.useFakeTimers();
    process.env.GATE_KEY_KMS = "local";
    process.env.GATE_KEY_LOCAL_KEK = Buffer.alloc(32, 9).toString("base64");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("checks the audit seal before calling the KMS", async () => {
    const kmsCalls = vi.fn(
      async () => new Response(JSON.stringify({ accessToken: "t" })),
    );
    vi.stubGlobal("fetch", kmsCalls);
    process.env.GATE_KEY_KMS = "infisical";
    process.env.INFISICAL_KMS_SITE_URL = "https://kms.test";
    process.env.INFISICAL_KMS_CLIENT_ID = "id";
    process.env.INFISICAL_KMS_CLIENT_SECRET = "secret";
    process.env.INFISICAL_KMS_KEY_ID = "key";
    const t = makeT();
    const ownerId = await t.run((ctx) => ctx.db.insert("users", {}));

    await expect(
      asUser(t, ownerId).action(api.recovery_node.setup, {
        generation: 1,
        socialEnvelope: "x",
        shares: [],
        gateKey,
        _audit: { ip: "", country: "", ts: 0, sig: "" },
      }),
    ).rejects.toThrow();
    expect(kmsCalls).not.toHaveBeenCalled();
  });

  it("limits setup attempts per account", async () => {
    const t = makeT();
    const { owner } = await setupOwner(t); // 1st attempt
    const stale = async () =>
      await owner.action(api.recovery_node.setup, {
        generation: 1,
        socialEnvelope: "x",
        shares: [],
        gateKey,
        _audit: await signedAudit(),
      });
    for (let i = 1; i < 10; i++) {
      await expect(stale()).rejects.toThrow(/Stale recovery generation/);
    }

    await expect(stale()).rejects.toThrow(/Too many requests/);
  });

  it("retries the release when the KMS call fails", async () => {
    const t = makeT();
    const { ownerId, contacts } = await setupOwner(t);
    const request = await startRequest(t, ownerId);
    const { requestId } = request;
    await contactApproves(t, ownerId, contacts[0], request);
    await contactApproves(t, ownerId, contacts[1], request);

    // KMS outage when the window closes: the scheduled release fails.
    const kek = process.env.GATE_KEY_LOCAL_KEK;
    process.env.GATE_KEY_LOCAL_KEK = Buffer.alloc(32, 7).toString("base64");
    vi.advanceTimersByTime(RECOVERY_WINDOW_MS);
    await t.finishInProgressScheduledFunctions();
    expect(await statusOf(t, requestId)).toBe("approved_2");

    // The KMS is back: the retry releases.
    process.env.GATE_KEY_LOCAL_KEK = kek;
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await statusOf(t, requestId)).toBe("released");
  });
});
