import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import { sha256Hex } from "../lib/crypto";
import {
  asUser,
  asUserSession,
  makeT,
  seedSession,
  seedUser,
  seedVerifiedTotp,
  signedAudit,
} from "./test.helpers";

// A wrong code must count as an attempt even though the call fails: Convex
// rolls back every write of a mutation that throws, so a limiter that patches
// then throws never counts anything and the 6-digit code is brute-forceable.

const PHONE = "+33612345678";

describe("one-time code attempts", () => {
  it("locks a phone sign-in code after 5 wrong guesses", async () => {
    const t = makeT();
    await t.run(async (ctx) => {
      await ctx.db.insert("phone_auth_codes", {
        phoneNumber: PHONE,
        codeHash: await sha256Hex("123456"),
        expiresAt: Date.now() + 60_000,
        attempts: 0,
        intent: "signin",
      });
    });
    const guess = (code: string) =>
      t.mutation(internal.phone_auth.consumePhoneAuthCode, {
        phoneNumber: PHONE,
        code,
        intent: "signin",
      });
    for (let i = 0; i < 5; i++) {
      await expect(guess("000000")).resolves.toMatchObject({ ok: false });
    }
    // The right code no longer works once the attempts are used up.
    await expect(guess("123456")).rejects.toThrow("Too many attempts");
  });

  it("counts wrong guesses on phone verification too", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("phone_verification_codes", {
        userId,
        phoneNumber: PHONE,
        codeHash: await sha256Hex("123456"),
        expiresAt: Date.now() + 60_000,
        attempts: 0,
      });
    });
    const as = asUser(t, userId);
    const verify = async (code: string) =>
      as.mutation(api.phone_verification.verifyCode, {
        code,
        _audit: await signedAudit(),
      });
    await expect(verify("000000")).resolves.toEqual({
      verified: false,
      error: "Invalid code",
    });
    const row = await t.run((ctx) =>
      ctx.db.query("phone_verification_codes").first(),
    );
    expect(row?.attempts).toBe(1);
    // A failed guess leaves no audit entry.
    expect(await t.run((ctx) => ctx.db.query("audit_logs").collect())).toEqual(
      [],
    );
  });

  it("locks TOTP after 10 wrong codes", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await seedVerifiedTotp(t, userId);
    const sessionId = await seedSession(t, userId);
    const as = asUserSession(t, userId, sessionId);
    for (let i = 0; i < 10; i++) {
      await expect(
        as.mutation(api.totp.submitTotpForSession, { code: "000000" }),
      ).resolves.toMatchObject({ success: false });
    }
    await expect(
      as.mutation(api.totp.submitTotpForSession, { code: "000000" }),
    ).rejects.toThrow("Too many attempts");
  });
});
