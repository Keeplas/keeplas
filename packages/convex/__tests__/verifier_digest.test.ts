import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  asUser,
  asUserSession,
  makeT,
  seedPasswordAccount,
  seedSession,
  seedVerifiedTotp,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

// The 24-word verifiers are bearer credentials: whoever submits one gets a
// recovery sign-in, clears the step-up gates or resets the password. The
// server stores a digest of each, so a read of the users table (backup,
// export, projection bug) hands out nothing that can be submitted. Rows
// written before the digest keep verifying until the backfill rewrites them.

const PHONE = "+33612345678";
const EMAIL = "ada@example.com";
const VERIFIER = "a".repeat(64);
const TOTP_VERIFIER = "b".repeat(64);

async function seedOwner(
  t: TestConvex,
  fields: { recoveryPhraseHash?: string; totpResetVerifierHash?: string },
) {
  return await t.run((ctx) =>
    ctx.db.insert("users", { email: EMAIL, phoneNumber: PHONE, ...fields }),
  );
}

const stored = (t: TestConvex, userId: Id<"users">) =>
  t.run(async (ctx) => {
    const user = await ctx.db.get(userId);
    return {
      recovery: user?.recoveryPhraseHash ?? "",
      totp: user?.totpResetVerifierHash ?? "",
    };
  });

/** Every check a recovery-phrase verifier passes, true when all accept it. */
async function phraseVerifierAccepted(
  t: TestConvex,
  userId: Id<"users">,
  verifier: string,
) {
  const byPhone = await t.query(internal.phone_auth.verifyPhoneRecovery, {
    phoneNumber: PHONE,
    phraseHash: verifier,
  });
  const byEmail = await t.query(internal.email_auth.verifyEmailRecovery, {
    email: EMAIL,
    phraseHash: verifier,
  });
  const forReset = await t.query(
    internal.passwordReset.verifyRecoveryPhraseInternal,
    { email: EMAIL, phraseHash: verifier },
  );
  const loginOtp = await asUserSession(t, userId, await seedSession(t, userId))
    .mutation(api.login_otp.submitLoginOtpRecovery, { verifierHash: verifier })
    .then(
      () => true,
      () => false,
    );
  return [byPhone, byEmail, forReset].every((id) => id === userId) && loginOtp;
}

async function totpVerifierAccepted(
  t: TestConvex,
  userId: Id<"users">,
  verifier: string,
) {
  return await asUserSession(t, userId, await seedSession(t, userId))
    .mutation(api.totp.submitTotpRecovery, { verifierHash: verifier })
    .then(
      () => true,
      () => false,
    );
}

describe("recovery verifier digest", () => {
  it("stores a digest of a new recovery-phrase verifier, and only the verifier opens it", async () => {
    const t = makeT();
    const userId = await seedOwner(t, {});
    await asUser(t, userId).mutation(api.onboarding.storeRecoveryPhraseHash, {
      recoveryPhraseHash: VERIFIER,
      phraseSalt: "salt",
    });

    const { recovery } = await stored(t, userId);
    expect(recovery).not.toBe(VERIFIER);
    expect(await phraseVerifierAccepted(t, userId, recovery)).toBe(false);
    expect(await phraseVerifierAccepted(t, userId, VERIFIER)).toBe(true);
  });

  it("stores a digest of a new TOTP-reset verifier, and only the verifier opens it", async () => {
    const t = makeT();
    const userId = await seedOwner(t, {});
    await seedVerifiedTotp(t, userId);
    // A phone-proven session that cleared TOTP may bind the verifier.
    const sessionId = await seedSession(t, userId);
    await t.run(async (ctx) => {
      const verifiedAt = Date.now();
      await ctx.db.insert("auth_session_proofs", {
        sessionId,
        userId,
        kind: "phone",
        verifiedAt,
      });
      await ctx.db.insert("auth_session_totp", {
        sessionId,
        userId,
        verifiedAt,
      });
    });
    await asUserSession(t, userId, sessionId).mutation(
      api.totp.bindRecoveryReset,
      { recoveryVerifierHash: TOTP_VERIFIER, _audit: await signedAudit() },
    );

    const { totp } = await stored(t, userId);
    expect(totp).not.toBe(TOTP_VERIFIER);
    expect(await totpVerifierAccepted(t, userId, totp)).toBe(false);
    expect(await totpVerifierAccepted(t, userId, TOTP_VERIFIER)).toBe(true);
  });

  it("keeps a legacy row (the verifier itself) working", async () => {
    const t = makeT();
    const userId = await seedOwner(t, {
      recoveryPhraseHash: VERIFIER,
      totpResetVerifierHash: TOTP_VERIFIER,
    });
    await seedVerifiedTotp(t, userId);

    expect(await phraseVerifierAccepted(t, userId, VERIFIER)).toBe(true);
    expect(await totpVerifierAccepted(t, userId, TOTP_VERIFIER)).toBe(true);
  });

  it("backfills legacy rows to digests that still accept the original verifiers", async () => {
    const t = makeT();
    const userId = await seedOwner(t, {
      recoveryPhraseHash: VERIFIER,
      totpResetVerifierHash: TOTP_VERIFIER,
    });
    await seedPasswordAccount(t, userId);
    await seedVerifiedTotp(t, userId);

    await t.mutation(internal.migrations.digestRecoveryVerifiers, {});
    const after = await stored(t, userId);
    expect(after.recovery).not.toBe(VERIFIER);
    expect(after.totp).not.toBe(TOTP_VERIFIER);

    // Idempotent: a second run leaves the digests alone.
    await t.mutation(internal.migrations.digestRecoveryVerifiers, {});
    expect(await stored(t, userId)).toEqual(after);

    expect(await phraseVerifierAccepted(t, userId, after.recovery)).toBe(false);
    expect(await phraseVerifierAccepted(t, userId, VERIFIER)).toBe(true);
    expect(await totpVerifierAccepted(t, userId, TOTP_VERIFIER)).toBe(true);
  });
});
