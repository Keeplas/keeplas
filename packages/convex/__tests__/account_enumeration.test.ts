import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import { SIGNUP_ATTESTATION_REQUIRED } from "../attestation";
import { makeT, signedAudit, type TestConvex } from "./test.helpers";

// The pre-auth code requests must not tell an anonymous caller whether a
// number or an address has a Keeplas account.

const PHONE = "+33612345678";
const EMAIL = "someone@example.com";

const pending = (t: TestConvex) =>
  t.run(async (ctx) => ({
    codes:
      (await ctx.db.query("phone_auth_codes").collect()).length +
      (await ctx.db.query("email_auth_codes").collect()).length,
    scheduled: (await ctx.db.system.query("_scheduled_functions").collect())
      .length,
  }));

describe("phone code requests", () => {
  it("answers a sign-in for an unknown number like any other, sending nothing", async () => {
    const t = makeT();
    await expect(
      t.mutation(api.phone_auth.requestPhoneAuthOtp, {
        phoneNumber: PHONE,
        intent: "signin",
      }),
    ).resolves.toEqual({ sent: true });
    expect(await pending(t)).toEqual({ codes: 0, scheduled: 0 });
  });

  it("asks for the app's attestation before saying a number is taken", async () => {
    const t = makeT();
    await t.run((ctx) => ctx.db.insert("users", { phoneNumber: PHONE }));
    await expect(
      t.mutation(api.phone_auth.requestPhoneAuthOtp, {
        phoneNumber: PHONE,
        intent: "signup",
      }),
    ).rejects.toThrow(SIGNUP_ATTESTATION_REQUIRED);
  });
});

describe("email code requests", () => {
  it("answers a sign-in for an unknown address like any other, sending nothing", async () => {
    const t = makeT();
    await expect(
      t.mutation(api.email_auth.requestEmailAuthOtp, {
        email: EMAIL,
        intent: "signin",
        _audit: await signedAudit(),
      }),
    ).resolves.toEqual({ sent: true });
    expect(await pending(t)).toEqual({ codes: 0, scheduled: 0 });
  });

  it("throttles requests per IP across addresses", async () => {
    const t = makeT();
    const _audit = await signedAudit();
    const request = (n: number) =>
      t.mutation(api.email_auth.requestEmailAuthOtp, {
        email: `probe${n}@example.com`,
        intent: "signin",
        _audit,
      });
    for (let n = 0; n < 20; n++) await request(n);

    await expect(request(20)).rejects.toThrow("Too many requests");
  });
});
