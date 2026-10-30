import { afterEach, describe, expect, it, vi } from "vitest";
import { openCloudBackup, sealCloudBackup } from "@keeplas/crypto/cloud";
import { generateIdentityKeyPair, signBytes } from "@keeplas/crypto/sig";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { endSessions } from "../lib/sessions";
import { vaultProofMessage } from "../lib/vault_proof";
import { RECOVERY_REQUEST_TTL_MS, RECOVERY_WINDOW_MS } from "../recovery";
import {
  asPhoneProvenUser,
  asUserSession,
  makeT,
  seedPasswordAccount,
  seedSession,
  seedVerifiedTotp,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

// New or lost phone, every way back in (PRD: recovery ≠ succession). One
// `describe` per row of the case table; the attacker rows prove no single
// factor opens a vault and support never unlocks the cryptography.
//
//   A  new phone, same number, iCloud      WhatsApp code + cloud restore
//   B  lost number, iCloud                 support + 72 h → new number → restore
//   C  lost authenticator                  vault opened → identity signature → TOTP off
//   E  no iCloud, 24 words                 recovery sign-in → number change at once
//   I  attacker with the iCloud account    passkey session: no restore, no number swap
//   J  attacker with a SIM swap            restore envelope is useless without the CBK
//   K  attacker who fools support          still waits 72 h, owner cancels

const OLD = "+33611111111";
const NEW = "+33622222222";
const ATTACKER = "+33699999999";

async function seedOwner(t: TestConvex) {
  const identity = generateIdentityKeyPair();
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Ada Lovelace",
      email: "ada@example.com",
      phoneNumber: OLD,
      phoneNumberVerifiedAt: Date.now(),
      identityPublicKey: identity.publicKey,
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("authAccounts", {
      userId,
      provider: "phone-otp",
      providerAccountId: OLD,
    }),
  );
  return { userId, identitySecretKey: identity.secretKey };
}

/** A session opened without proving anything (e.g. a synced passkey). */
async function passkeySession(t: TestConvex, userId: Id<"users">) {
  const sessionId = await seedSession(t, userId);
  return { sessionId, as: asUserSession(t, userId, sessionId) };
}

/** The code of the latest WhatsApp OTP scheduled to `phone`. */
async function lastCodeSentTo(t: TestConvex, phone: string): Promise<string> {
  const jobs = await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect(),
  );
  const sent = jobs
    .filter((j) => j.name === "dispatch:sendWhatsAppOtp")
    .map((j) => j.args[0] as { phoneNumber: string; code: string })
    .filter((a) => a.phoneNumber === phone);
  const last = sent.at(-1);
  if (!last) throw new Error(`No code sent to ${phone}`);
  return last.code;
}

async function scheduledNames(t: TestConvex) {
  const jobs = await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect(),
  );
  return jobs.map((j) => j.name);
}

async function saveBackup(t: TestConvex, userId: Id<"users">) {
  const rootKey = crypto.getRandomValues(new Uint8Array(32));
  const sealed = await sealCloudBackup({ rootKey, userId });
  await t.run((ctx) =>
    ctx.db.insert("cloud_backup_envelopes", {
      userId,
      provider: "icloud",
      envelope: sealed.envelope,
      createdAt: Date.now(),
    }),
  );
  return { rootKey, cbk: sealed.cbk };
}

async function proveVault(
  t: TestConvex,
  userId: Id<"users">,
  sessionId: Id<"authSessions">,
  secretKey: string,
) {
  const as = asUserSession(t, userId, sessionId);
  const { nonce } = await as.mutation(api.session_proofs.startVaultProof, {});
  const signature = signBytes(secretKey, vaultProofMessage(userId, nonce));
  return { nonce, signature, as };
}

async function seedAdmin(t: TestConvex) {
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Support", role: "admin" }),
  );
  return asUserSession(t, adminId, await seedSession(t, adminId));
}

async function submitRequest(t: TestConvex, newPhone = NEW) {
  return t.mutation(api.number_change.submit, {
    oldPhone: OLD,
    newPhone,
    name: "Ada Lovelace",
    email: "ada@example.com",
    message: "Phone stolen in the metro.",
    _audit: await signedAudit(),
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("A — new phone, same number, cloud backup", () => {
  it("a phone sign-in session restores and the owner is alerted", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    const { rootKey, cbk } = await saveBackup(t, userId);
    const as = await asPhoneProvenUser(t, userId);
    const restored = await as.mutation(api.cloud_backup.restore, {
      _audit: await signedAudit(),
    });
    expect(
      await openCloudBackup({ envelope: restored.envelope, cbk, userId }),
    ).toEqual(rootKey);
    expect(await scheduledNames(t)).toContain("dispatch:notifyNewDevice");
  });

  it("an in-session WhatsApp code to the account's number grants the proof", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    await saveBackup(t, userId);
    const { as } = await passkeySession(t, userId);
    expect(await as.query(api.session_proofs.getMine, {})).toMatchObject({
      phone: false,
      vault: false,
    });
    await as.mutation(api.session_proofs.requestPhoneCode, {});
    const code = await lastCodeSentTo(t, OLD);
    await expect(
      as.mutation(api.session_proofs.verifyPhoneCode, { code }),
    ).resolves.toEqual({ success: true });
    expect(await as.query(api.session_proofs.getMine, {})).toMatchObject({
      phone: true,
    });
    await expect(
      as.mutation(api.cloud_backup.restore, { _audit: await signedAudit() }),
    ).resolves.toMatchObject({ provider: "icloud" });
  });

  it("counts a wrong in-session code and won't credit another session", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    const first = await passkeySession(t, userId);
    const second = await passkeySession(t, userId);
    await first.as.mutation(api.session_proofs.requestPhoneCode, {});
    const code = await lastCodeSentTo(t, OLD);
    const wrong = code === "000000" ? "111111" : "000000";
    await expect(
      first.as.mutation(api.session_proofs.verifyPhoneCode, { code: wrong }),
    ).resolves.toEqual({ success: false, error: "Invalid code" });
    const row = await t.run((ctx) =>
      ctx.db.query("session_phone_codes").first(),
    );
    expect(row?.attempts).toBe(1);
    // The code belongs to the session that asked for it.
    await expect(
      second.as.mutation(api.session_proofs.verifyPhoneCode, { code }),
    ).rejects.toThrow("Code expired or not requested");
  });

  it("a password account still needs its login OTP first", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    await saveBackup(t, userId);
    await seedPasswordAccount(t, userId);
    const as = await asPhoneProvenUser(t, userId);
    await expect(
      as.mutation(api.cloud_backup.restore, { _audit: await signedAudit() }),
    ).rejects.toThrow("LOGIN_OTP_REQUIRED");
  });

  it("phone sign-ins open their session with the proof", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    const sessionId = await t.mutation(
      internal.session_proofs.openProvenSession,
      { userId, kind: "phone" },
    );
    const as = asUserSession(t, userId, sessionId);
    expect(await as.query(api.session_proofs.getMine, {})).toMatchObject({
      phone: true,
      vault: false,
    });
  });
});

describe("I — attacker holding the owner's iCloud / Google account", () => {
  it("a synced passkey alone cannot restore the backup", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    await saveBackup(t, userId);
    const { as } = await passkeySession(t, userId);
    await expect(
      as.mutation(api.cloud_backup.restore, { _audit: await signedAudit() }),
    ).rejects.toThrow("PHONE_PROOF_REQUIRED");
  });

  it("nor ask the trust contacts to recover the vault", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    const { as } = await passkeySession(t, userId);
    await expect(
      as.mutation(api.recovery.start, {
        newDevicePublicKey: "x",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("PHONE_PROOF_REQUIRED");
  });

  it("nor swap the account's number for their own", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    const { as } = await passkeySession(t, userId);
    await expect(
      as.mutation(api.phone_verification.requestVerification, {
        phoneNumber: ATTACKER,
      }),
    ).rejects.toThrow("PROOF_REQUIRED");
  });

  it("nor swap in its own identity key to forge the vault proof", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    const owner = { publicKey: "owner-kem", encryptedAsymmetricSecretKey: "w" };
    await t.run((ctx) => ctx.db.patch(userId, owner));
    const { sessionId, as } = await passkeySession(t, userId);
    const attacker = generateIdentityKeyPair();
    await expect(
      as.mutation(api.users.setPublicKey, {
        ...owner,
        identityPublicKey: attacker.publicKey,
        publicKeySignature: "attacker-signature",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("already set");
    const { signature } = await proveVault(
      t,
      userId,
      sessionId,
      attacker.secretKey,
    );
    await expect(
      as.action(api.session_proofs_node.proveVault, { signature }),
    ).resolves.toEqual({ success: false });
  });

  it("nor read or plant the 24-word verifier to clear the step-up gates", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    await t.run((ctx) =>
      ctx.db.patch(userId, {
        encryptedKeyBundle: "owner-bundle",
        phraseSalt: "owner-salt",
        recoveryPhraseHash: "owner-verifier",
        totpResetVerifierHash: "owner-totp-verifier",
      }),
    );
    const { as } = await passkeySession(t, userId);
    const viewer = await as.query(api.users.viewer, {});
    expect(viewer).not.toHaveProperty("recoveryPhraseHash");
    expect(viewer).not.toHaveProperty("totpResetVerifierHash");
    await expect(
      as.mutation(api.onboarding.storeRecoveryPhraseHash, {
        recoveryPhraseHash: "attacker-verifier",
        phraseSalt: "owner-salt",
      }),
    ).rejects.toThrow("PROOF_REQUIRED");
    await expect(
      as.mutation(api.onboarding.storeKeyBundle, {
        encryptedKeyBundle: "junk",
        phraseSalt: "owner-salt",
      }),
    ).rejects.toThrow("PROOF_REQUIRED");
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.recoveryPhraseHash).toBe("owner-verifier");
    expect(user?.encryptedKeyBundle).toBe("owner-bundle");
  });

  it("nor swap the account's email for their own", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    await t.run((ctx) =>
      ctx.db.patch(userId, { emailVerificationTime: Date.now() }),
    );
    const { as } = await passkeySession(t, userId);
    await expect(
      as.mutation(api.email_verification.requestVerification, {
        email: "attacker@example.com",
      }),
    ).rejects.toThrow("PROOF_REQUIRED");
  });

  it("nor rotate in its own keys", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    const { as } = await passkeySession(t, userId);
    const attacker = generateIdentityKeyPair();
    await expect(
      as.mutation(api.rotation.rotateKeyMaterial, {
        encryptedKeyBundle: "junk",
        publicKey: "attacker-kem",
        publicKeySignature: "attacker-signature",
        identityPublicKey: attacker.publicKey,
        encryptedIdentitySecretKey: "attacker-wrapped",
        encryptedAsymmetricSecretKey: "attacker-wrapped",
        encryptedAsymmetricSecretKeyPrev: "attacker-wrapped",
        encryptedRetiredSecretKeys: "attacker-wrapped",
        categoryNames: [],
        folderNames: [],
        contactPins: [],
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("VAULT_PROOF_REQUIRED");
  });

  it("a first number (migration) is not gated", async () => {
    const t = makeT();
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "new@example.com" }),
    );
    const { as } = await passkeySession(t, userId);
    await expect(
      as.mutation(api.phone_verification.requestVerification, {
        phoneNumber: NEW,
      }),
    ).resolves.toEqual({ sent: true });
  });
});

describe("J — attacker with a SIM swap", () => {
  it("gets the envelope but cannot open it without the owner's synced key", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    await saveBackup(t, userId);
    const as = await asPhoneProvenUser(t, userId);
    const { envelope } = await as.mutation(api.cloud_backup.restore, {
      _audit: await signedAudit(),
    });
    const { cbk: attackerKey } = await sealCloudBackup({
      rootKey: new Uint8Array(32),
      userId,
    });
    await expect(
      openCloudBackup({ envelope, cbk: attackerKey, userId }),
    ).rejects.toThrow();
    // …and the owner hears about it.
    expect(await scheduledNames(t)).toContain("dispatch:notifyNewDevice");
  });
});

describe("C — lost authenticator: the opened vault resets TOTP", () => {
  it("a valid identity signature proves the vault and turns TOTP off", async () => {
    const t = makeT();
    const { userId, identitySecretKey } = await seedOwner(t);
    await seedVerifiedTotp(t, userId);
    const { sessionId } = await passkeySession(t, userId);
    const { signature, as } = await proveVault(
      t,
      userId,
      sessionId,
      identitySecretKey,
    );
    expect(await as.query(api.totp.getMyTotpGate, {})).toMatchObject({
      required: true,
    });
    await expect(
      as.action(api.session_proofs_node.proveVault, { signature }),
    ).resolves.toEqual({ success: true });
    await as.mutation(api.totp.resetWithVaultProof, {});
    expect(await as.query(api.totp.getMyTotpGate, {})).toMatchObject({
      required: false,
    });
    const logs = await t.run((ctx) => ctx.db.query("audit_logs").collect());
    expect(logs.map((l) => l.action)).toContain("totp_vault_reset");
  });

  it("refuses the reset without the vault proof", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    await seedVerifiedTotp(t, userId);
    const { as } = await passkeySession(t, userId);
    await expect(as.mutation(api.totp.resetWithVaultProof, {})).rejects.toThrow(
      "VAULT_PROOF_REQUIRED",
    );
  });

  it("refuses another key's signature, a replay and an expired nonce", async () => {
    const t = makeT();
    const { userId, identitySecretKey } = await seedOwner(t);
    const { sessionId } = await passkeySession(t, userId);
    const as = asUserSession(t, userId, sessionId);

    // Someone else's identity key.
    const stranger = generateIdentityKeyPair();
    const forged = await proveVault(t, userId, sessionId, stranger.secretKey);
    await expect(
      as.action(api.session_proofs_node.proveVault, {
        signature: forged.signature,
      }),
    ).resolves.toEqual({ success: false });

    // A good signature works once: the nonce is spent.
    const good = await proveVault(t, userId, sessionId, identitySecretKey);
    await as.action(api.session_proofs_node.proveVault, {
      signature: good.signature,
    });
    const other = await passkeySession(t, userId);
    await expect(
      other.as.action(api.session_proofs_node.proveVault, {
        signature: good.signature,
      }),
    ).resolves.toEqual({ success: false });

    // Past its 5 minutes, a nonce is refused.
    vi.useFakeTimers();
    const late = await proveVault(
      t,
      userId,
      other.sessionId,
      identitySecretKey,
    );
    vi.advanceTimersByTime(6 * 60 * 1000);
    await expect(
      other.as.action(api.session_proofs_node.proveVault, {
        signature: late.signature,
      }),
    ).resolves.toEqual({ success: false });
    expect(await other.as.query(api.session_proofs.getMine, {})).toMatchObject({
      vault: false,
    });
  });
});

describe("E — 24 words, no cloud backup", () => {
  it("the recovery sign-in proves the vault, so the number changes at once", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    const sessionId = await t.mutation(
      internal.session_proofs.openProvenSession,
      { userId, kind: "vault" },
    );
    const as = asUserSession(t, userId, sessionId);
    await as.mutation(api.phone_verification.requestVerification, {
      phoneNumber: NEW,
    });
    const code = await t.run(async (ctx) => {
      const jobs = await ctx.db.system.query("_scheduled_functions").collect();
      return (jobs.at(-1)!.args[0] as { code: string }).code;
    });
    await expect(
      as.mutation(api.phone_verification.verifyCode, {
        code,
        _audit: await signedAudit(),
      }),
    ).resolves.toMatchObject({ verified: true, phoneNumber: NEW });
    // The new number now proves this session: restore and contacts open up.
    expect(await as.query(api.session_proofs.getMine, {})).toMatchObject({
      phone: true,
      vault: true,
    });
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.phoneNumber).toBe(NEW);
  });
});

describe("B / D / F — lost number, no 24 words: support + 72 h", () => {
  async function approved(t: TestConvex) {
    const { requestId, claimToken } = await submitRequest(t);
    const admin = await seedAdmin(t);
    await admin.mutation(api.admin.recovery_requests.approve, { requestId });
    return { requestId, claimToken, admin };
  }

  it("alerts the owner and the reviewer when a request starts", async () => {
    const t = makeT();
    await seedOwner(t);
    const { requestId, windowEndsAt } = await submitRequest(t);
    const row = await t.run((ctx) => ctx.db.get(requestId));
    expect(row).toMatchObject({ status: "pending", newPhone: NEW });
    expect(windowEndsAt - row!.createdAt).toBe(RECOVERY_WINDOW_MS);
    const names = await scheduledNames(t);
    expect(names).toContain("dispatch:notifyNumberChangeRequested");
    expect(names).toContain("support:notifyRecoveryReviewer");
  });

  it("refuses unknown numbers, the same number, a taken number and a second request", async () => {
    const t = makeT();
    await seedOwner(t);
    await t.run((ctx) => ctx.db.insert("users", { phoneNumber: ATTACKER }));
    await expect(
      t.mutation(api.number_change.submit, {
        oldPhone: "+33600000000",
        newPhone: NEW,
        name: "X",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("NO_ACCOUNT");
    await expect(submitRequest(t, OLD)).rejects.toThrow("SAME_NUMBER");
    await expect(submitRequest(t, ATTACKER)).rejects.toThrow("already linked");
    await submitRequest(t);
    await expect(submitRequest(t)).rejects.toThrow("REQUEST_IN_PROGRESS");
  });

  it("completes only once approved and past 72 h, then signs in on the new number", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const { userId } = await seedOwner(t);
    const lostPhone = await passkeySession(t, userId);
    const { requestId, claimToken } = await approved(t);
    const claim = { requestId, claimToken };

    // Approved, but inside the window: no code yet.
    await expect(
      t.mutation(api.number_change.requestCompletionCode, claim),
    ).rejects.toThrow("NOT_READY");

    vi.advanceTimersByTime(RECOVERY_WINDOW_MS);
    await t.mutation(api.number_change.requestCompletionCode, claim);
    const code = await lastCodeSentTo(t, NEW);
    const result = await t.mutation(internal.number_change.complete, {
      ...claim,
      code,
    });
    expect(result).toEqual({ ok: true, userId });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.phoneNumber).toBe(NEW);
    const login = await t.run((ctx) =>
      ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", userId).eq("provider", "phone-otp"),
        )
        .first(),
    );
    expect(login?.providerAccountId).toBe(NEW);
    // The lost phone's session is gone.
    expect(await t.run((ctx) => ctx.db.get(lostPhone.sessionId))).toBeNull();
    expect(await t.query(api.number_change.status, claim)).toMatchObject({
      status: "completed",
    });
    // Signing in still leaves the vault closed: no vault proof, no data.
    const sessionId = await t.mutation(
      internal.session_proofs.openProvenSession,
      { userId, kind: "phone" },
    );
    expect(
      await asUserSession(t, userId, sessionId).query(
        api.session_proofs.getMine,
        {},
      ),
    ).toMatchObject({ phone: true, vault: false });
  });

  it("never completes without support's approval, even after 72 h", async () => {
    vi.useFakeTimers();
    const t = makeT();
    await seedOwner(t);
    const claim = await submitRequest(t);
    vi.advanceTimersByTime(RECOVERY_WINDOW_MS + 1);
    await expect(
      t.mutation(api.number_change.requestCompletionCode, {
        requestId: claim.requestId,
        claimToken: claim.claimToken,
      }),
    ).rejects.toThrow("NOT_READY");
  });

  it("needs the claim secret the requesting phone was given", async () => {
    vi.useFakeTimers();
    const t = makeT();
    await seedOwner(t);
    const { requestId } = await approved(t);
    vi.advanceTimersByTime(RECOVERY_WINDOW_MS);
    const forged = { requestId, claimToken: "guess" };
    expect(await t.query(api.number_change.status, forged)).toBeNull();
    await expect(
      t.mutation(api.number_change.requestCompletionCode, forged),
    ).rejects.toThrow("NOT_READY");
  });

  it("counts a wrong completion code", async () => {
    vi.useFakeTimers();
    const t = makeT();
    await seedOwner(t);
    const { requestId, claimToken } = await approved(t);
    vi.advanceTimersByTime(RECOVERY_WINDOW_MS);
    await t.mutation(api.number_change.requestCompletionCode, {
      requestId,
      claimToken,
    });
    const code = await lastCodeSentTo(t, NEW);
    const wrong = code === "000000" ? "111111" : "000000";
    await expect(
      t.mutation(internal.number_change.complete, {
        requestId,
        claimToken,
        code: wrong,
      }),
    ).resolves.toEqual({ ok: false, error: "Invalid code" });
    const row = await t.run((ctx) =>
      ctx.db
        .query("phone_auth_codes")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", NEW))
        .first(),
    );
    expect(row?.attempts).toBe(1);
  });

  it("lapses after 7 days, and the requester can withdraw", async () => {
    vi.useFakeTimers();
    const t = makeT();
    await seedOwner(t);
    const { requestId, claimToken } = await approved(t);
    const first = { requestId, claimToken };
    vi.advanceTimersByTime(RECOVERY_REQUEST_TTL_MS);
    expect(await t.query(api.number_change.status, first)).toMatchObject({
      expired: true,
    });
    await expect(
      t.mutation(api.number_change.requestCompletionCode, first),
    ).rejects.toThrow("NOT_READY");
    // A lapsed request no longer blocks a new one, which can be withdrawn.
    const { requestId: id2, claimToken: token2 } = await submitRequest(t);
    const second = { requestId: id2, claimToken: token2 };
    await t.mutation(api.number_change.withdraw, second);
    expect(await t.query(api.number_change.status, second)).toMatchObject({
      status: "cancelled",
    });
  });
});

describe("K — attacker who fools support", () => {
  it("the owner's \"It wasn't me\" stops even an approved request", async () => {
    vi.useFakeTimers();
    const t = makeT();
    const { userId } = await seedOwner(t);
    const { requestId, claimToken } = await submitRequest(t, ATTACKER);
    const admin = await seedAdmin(t);
    await admin.mutation(api.admin.recovery_requests.approve, { requestId });

    // The owner still has a signed-in phone and cancels from it.
    const owner = await asPhoneProvenUser(t, userId);
    expect(await owner.query(api.number_change.getMineOpen, {})).toMatchObject({
      requestId,
      status: "approved",
    });
    await owner.mutation(api.number_change.cancel, {
      _audit: await signedAudit(),
    });
    expect(await owner.query(api.number_change.getMineOpen, {})).toBeNull();

    vi.advanceTimersByTime(RECOVERY_WINDOW_MS);
    await expect(
      t.mutation(api.number_change.requestCompletionCode, {
        requestId,
        claimToken,
      }),
    ).rejects.toThrow("NOT_READY");
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.phoneNumber).toBe(OLD);
  });

  it("only admins review, and the review exposes no vault data", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    await t.run((ctx) =>
      ctx.db.patch(userId, {
        encryptedKeyBundle: "SECRET-BUNDLE",
        encryptedIdentitySecretKey: "SECRET-ID",
      }),
    );
    const { requestId } = await submitRequest(t);
    const { as: stranger } = await passkeySession(t, userId);
    await expect(
      stranger.mutation(api.admin.recovery_requests.approve, { requestId }),
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      stranger.query(api.admin.recovery_requests.listOpen, {}),
    ).rejects.toThrow("FORBIDDEN");

    const admin = await seedAdmin(t);
    const detail = await admin.query(api.admin.recovery_requests.get, {
      requestId,
    });
    expect(detail).toMatchObject({
      declaredName: "Ada Lovelace",
      accountName: "Ada Lovelace",
      oldPhone: OLD,
      newPhone: NEW,
    });
    expect(JSON.stringify(detail)).not.toContain("SECRET");
    expect(JSON.stringify(detail)).not.toContain("claimHash");
  });

  it("a rejected request is closed for good, and verdicts are audited", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    const { requestId } = await submitRequest(t);
    const admin = await seedAdmin(t);
    await admin.mutation(api.admin.recovery_requests.reject, {
      requestId,
      note: "Name does not match",
    });
    await expect(
      admin.mutation(api.admin.recovery_requests.approve, { requestId }),
    ).rejects.toThrow("NOT_REVIEWABLE");
    const actions = (
      await t.run((ctx) =>
        ctx.db
          .query("audit_logs")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
      )
    ).map((l) => l.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "number_change.requested",
        "number_change.rejected",
      ]),
    );
  });
});

describe("session proofs end with their session", () => {
  it("ending a session (revoke, number change) drops what it proved", async () => {
    const t = makeT();
    const { userId } = await seedOwner(t);
    await asPhoneProvenUser(t, userId);
    await t.run((ctx) => endSessions(ctx, userId));
    expect(
      await t.run((ctx) => ctx.db.query("auth_session_proofs").collect()),
    ).toEqual([]);
  });
});
