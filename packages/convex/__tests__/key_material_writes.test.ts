import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  makeT,
  seedUser,
  asPhoneProvenUser,
  asUserSession,
  seedSession,
  seedPasswordAccount,
  seedVerifiedTotp,
  clearTotp,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

// The recovery verifier, key bundle and key material prove who owns the
// account. Onboarding writes them on a plain session; once the vault exists,
// replacing them needs every step-up gate plus a "phone" or "vault" proof
// from this session (session_proofs.ts).

const KIT = { recoveryPhraseHash: "new-verifier", phraseSalt: "new-salt" };
const BUNDLE = { encryptedKeyBundle: "new-bundle", phraseSalt: "new-salt" };

/** An account that finished onboarding before this change (legacy shape). */
async function seedOnboardedUser(t: TestConvex): Promise<Id<"users">> {
  const userId = await seedUser(t);
  await t.run((ctx) =>
    ctx.db.patch(userId, {
      recoveryPhraseHash: "old-verifier",
      phraseSalt: "old-salt",
      encryptedKeyBundle: "old-bundle",
      recoveryVerified: true,
      onboardingStep: "complete",
      welcomeSentAt: Date.now(),
    }),
  );
  return userId;
}

async function asVaultProvenUser(t: TestConvex, userId: Id<"users">) {
  const sessionId = await seedSession(t, userId);
  await t.run((ctx) =>
    ctx.db.insert("auth_session_proofs", {
      sessionId,
      userId,
      kind: "vault",
      verifiedAt: Date.now(),
    }),
  );
  return asUserSession(t, userId, sessionId);
}

describe("onboarding — first vault", () => {
  it("writes the kit on a plain session before the vault exists", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const as = asUserSession(t, userId, await seedSession(t, userId));
    await as.mutation(api.onboarding.storeRecoveryPhraseHash, KIT);
    // A retried setup with new material, still before the bundle exists.
    await as.mutation(api.onboarding.storeRecoveryPhraseHash, {
      ...KIT,
      recoveryPhraseHash: "retried-verifier",
    });
    await as.mutation(api.onboarding.storeKeyBundle, BUNDLE);
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.recoveryPhraseHash).toBe("retried-verifier");
    expect(user?.encryptedKeyBundle).toBe("new-bundle");
    expect(user?.onboardingStep).toBe("complete");
  });
});

describe("onboarding — replacing the kit of an existing vault", () => {
  it("works on a phone sign-in session (contact recovery, Settings kit)", async () => {
    const t = makeT();
    const userId = await seedOnboardedUser(t);
    const as = await asPhoneProvenUser(t, userId);
    await as.mutation(api.onboarding.storeRecoveryPhraseHash, KIT);
    await as.mutation(api.onboarding.storeKeyBundle, BUNDLE);
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.recoveryPhraseHash).toBe("new-verifier");
    expect(user?.encryptedKeyBundle).toBe("new-bundle");
    expect(user?.onboardingStep).toBe("complete");
  });

  it("works on a session that proved the vault (passkey sign-in)", async () => {
    const t = makeT();
    const userId = await seedOnboardedUser(t);
    const as = await asVaultProvenUser(t, userId);
    await as.mutation(api.onboarding.storeRecoveryPhraseHash, KIT);
    await as.mutation(api.onboarding.storeKeyBundle, BUNDLE);
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.recoveryPhraseHash).toBe("new-verifier");
  });

  it("still needs the step-up gates on a proven session", async () => {
    const t = makeT();
    const userId = await seedOnboardedUser(t);
    await seedPasswordAccount(t, userId);
    const as = await asPhoneProvenUser(t, userId);
    await expect(
      as.mutation(api.onboarding.storeRecoveryPhraseHash, KIT),
    ).rejects.toThrow("LOGIN_OTP_REQUIRED");
    await expect(
      as.mutation(api.onboarding.storeKeyBundle, BUNDLE),
    ).rejects.toThrow("LOGIN_OTP_REQUIRED");
  });

  it("refuses a session that proved nothing", async () => {
    const t = makeT();
    const userId = await seedOnboardedUser(t);
    const as = asUserSession(t, userId, await seedSession(t, userId));
    await expect(
      as.mutation(api.onboarding.storeRecoveryPhraseHash, KIT),
    ).rejects.toThrow("PROOF_REQUIRED");
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.recoveryPhraseHash).toBe("old-verifier");
  });
});

describe("totp.bindRecoveryReset", () => {
  async function totpSession(t: TestConvex, proven: boolean) {
    const userId = await seedUser(t);
    await seedVerifiedTotp(t, userId);
    const sessionId = await seedSession(t, userId);
    await clearTotp(t, userId, sessionId);
    if (proven) {
      await t.run((ctx) =>
        ctx.db.insert("auth_session_proofs", {
          sessionId,
          userId,
          kind: "vault",
          verifiedAt: Date.now(),
        }),
      );
    }
    return { userId, as: asUserSession(t, userId, sessionId) };
  }

  it("refuses a session that proved nothing", async () => {
    const t = makeT();
    const { as } = await totpSession(t, false);
    await expect(
      as.mutation(api.totp.bindRecoveryReset, {
        recoveryVerifierHash: "attacker-verifier",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("PROOF_REQUIRED");
  });

  it("binds the verifier on a proven session", async () => {
    const t = makeT();
    const { userId, as } = await totpSession(t, true);
    await as.mutation(api.totp.bindRecoveryReset, {
      recoveryVerifierHash: "owner-verifier",
      _audit: await signedAudit(),
    });
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.totpResetVerifierHash).toBe("owner-verifier");
  });
});
