import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateRecipientKeyPair,
  serializePublicKey,
} from "@keeplas/crypto/kem";
import { generateIdentityKeyPair } from "@keeplas/crypto/sig";
import {
  approveRecovery,
  createSocialRecovery,
  openSocialRecovery,
  recoveryCode,
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

async function startRequest(t: TestConvex, ownerId: Id<"users">) {
  const device = generateRecipientKeyPair();
  const devicePublicKey = serializePublicKey(device.publicKey);
  const newDevice = await asPhoneProvenUser(t, ownerId);
  const requestId = await newDevice.mutation(api.recovery.start, {
    newDevicePublicKey: devicePublicKey,
    _audit: await signedAudit(),
  });
  return { requestId, device, devicePublicKey, newDevice };
}

async function contactApproves(
  t: TestConvex,
  ownerId: Id<"users">,
  contact: Contact,
) {
  const as = asUser(t, contact.userId);
  const [pending] = await as.query(api.recovery.getRequestsForMe, {});
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
    const { requestId, device, devicePublicKey, newDevice } =
      await startRequest(t, ownerId);
    expect(await statusOf(t, requestId)).toBe("pending");

    // Both sides compute the same code locally (D4).
    const [forContact] = await asUser(t, contacts[0].userId).query(
      api.recovery.getRequestsForMe,
      {},
    );
    expect(
      await recoveryCode(forContact.requestId, forContact.newDevicePublicKey),
    ).toBe(await recoveryCode(requestId, devicePublicKey));

    await contactApproves(t, ownerId, contacts[0]);
    expect(await statusOf(t, requestId)).toBe("approved_1");
    await contactApproves(t, ownerId, contacts[2]);
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
    const { requestId } = await startRequest(t, ownerId);
    await contactApproves(t, ownerId, contacts[0]);
    vi.advanceTimersByTime(RECOVERY_WINDOW_MS + 1);
    expect(await statusOf(t, requestId)).toBe("approved_1");
    await contactApproves(t, ownerId, contacts[1]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await statusOf(t, requestId)).toBe("released");
  });

  it("cancel from any owner device stops the release and requires a renewal", async () => {
    const t = makeT();
    const { ownerId, owner, contacts } = await setupOwner(t);
    const { requestId } = await startRequest(t, ownerId);
    await contactApproves(t, ownerId, contacts[0]);
    await contactApproves(t, ownerId, contacts[1]);
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
    const { requestId } = await startRequest(t, ownerId);
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
    await expect(contactApproves(t, ownerId, contacts[0])).rejects.toThrow();
  });

  it("expires after 7 days without 2 approvals", async () => {
    const t = makeT();
    const { ownerId, contacts } = await setupOwner(t);
    const { requestId } = await startRequest(t, ownerId);
    await contactApproves(t, ownerId, contacts[0]);
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
    await startRequest(t, ownerId);
    await expect(startRequest(t, ownerId)).rejects.toThrow(
      "already in progress",
    );
    await contactApproves(t, ownerId, contacts[0]);
    // The request no longer shows up for a contact who answered.
    expect(
      await asUser(t, contacts[0].userId).query(
        api.recovery.getRequestsForMe,
        {},
      ),
    ).toEqual([]);
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
    const { requestId } = await startRequest(t, ownerId);
    await contactApproves(t, ownerId, contacts[0]);
    await contactApproves(t, ownerId, contacts[1]);

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
