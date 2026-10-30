import { describe, it, expect } from "vitest";
import { anyApi } from "convex/server";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  makeT,
  asPhoneProvenUser,
  asUserSession,
  clearLoginOtp,
  seedPasswordAccount,
  seedSession,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

// Adding or replacing a sign-in identifier (phone, email) makes it a login
// method and the login-OTP channel: a session must clear every step-up gate
// first, and replacing a verified one also needs a "phone" / "vault" proof.

/** Legacy email + password account with no verified phone. */
async function seedPasswordUser(t: TestConvex): Promise<Id<"users">> {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "owner@example.com",
      emailVerificationTime: Date.now(),
    }),
  );
  await seedPasswordAccount(t, userId);
  return userId;
}

/** A session opened with the password only (login OTP not cleared). */
async function passwordOnlySession(t: TestConvex, userId: Id<"users">) {
  return asUserSession(t, userId, await seedSession(t, userId));
}

describe("login OTP — no signup-credit shortcut", () => {
  it("a just-verified phone does not clear the gate", async () => {
    const t = makeT();
    const userId = await seedPasswordUser(t);
    const as = await passwordOnlySession(t, userId);
    await t.run((ctx) =>
      ctx.db.patch(userId, {
        phoneNumber: "+33699999999",
        phoneNumberVerifiedAt: Date.now(),
      }),
    );
    await expect(
      as.mutation(anyApi.login_otp.creditSignupSession, {}),
    ).rejects.toThrow();
    await expect(
      as.query(api.trusted_contacts.getContacts, {}),
    ).rejects.toThrow("LOGIN_OTP_REQUIRED");
  });
});

describe("phone_verification — first number", () => {
  it("a password alone cannot add a phone", async () => {
    const t = makeT();
    const userId = await seedPasswordUser(t);
    const as = await passwordOnlySession(t, userId);
    await expect(
      as.mutation(api.phone_verification.requestVerification, {
        phoneNumber: "+33699999999",
      }),
    ).rejects.toThrow("LOGIN_OTP_REQUIRED");
    await expect(
      as.mutation(api.phone_verification.verifyCode, {
        code: "000000",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("LOGIN_OTP_REQUIRED");
  });

  it("works once the login OTP is cleared", async () => {
    const t = makeT();
    const userId = await seedPasswordUser(t);
    const sessionId = await seedSession(t, userId);
    await clearLoginOtp(t, userId, sessionId);
    await expect(
      asUserSession(t, userId, sessionId).mutation(
        api.phone_verification.requestVerification,
        { phoneNumber: "+33612345678" },
      ),
    ).resolves.toEqual({ sent: true });
  });
});

describe("email_verification", () => {
  it("a password alone cannot add or change the email", async () => {
    const t = makeT();
    const userId = await seedPasswordUser(t);
    const as = await passwordOnlySession(t, userId);
    await expect(
      as.mutation(api.email_verification.requestVerification, {
        email: "attacker@example.com",
      }),
    ).rejects.toThrow("LOGIN_OTP_REQUIRED");
    await expect(
      as.mutation(api.email_verification.verifyCodeAndLink, {
        code: "000000",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("LOGIN_OTP_REQUIRED");
  });

  it("changing a verified email needs a phone or vault proof", async () => {
    const t = makeT();
    const userId = await seedPasswordUser(t);
    const sessionId = await seedSession(t, userId);
    await clearLoginOtp(t, userId, sessionId);
    await expect(
      asUserSession(t, userId, sessionId).mutation(
        api.email_verification.requestVerification,
        { email: "new@example.com" },
      ),
    ).rejects.toThrow("PROOF_REQUIRED");
  });

  it("a phone account adds its first email on a phone sign-in", async () => {
    const t = makeT();
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        phoneNumber: "+33611111111",
        phoneNumberVerifiedAt: Date.now(),
      }),
    );
    const as = await asPhoneProvenUser(t, userId);
    await expect(
      as.mutation(api.email_verification.requestVerification, {
        email: "first@example.com",
      }),
    ).resolves.toEqual({ sent: true });
  });
});
