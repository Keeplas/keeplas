import { afterEach, describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import { SIGNUP_ATTESTATION_REQUIRED } from "../attestation";
import { INVALID_CODE, OTP_MAX_ATTEMPTS } from "../lib/otp";
import { CODE_REQUESTS_PER_IP } from "../phone_auth";
import {
  makeT,
  signedAudit,
  signedAuditFrom,
  type TestConvex,
} from "./test.helpers";

const TEST_PHONE = "+33600000001";
const REAL_PHONE = "+33612345678";

async function seedPhoneUser(t: TestConvex, phoneNumber: string) {
  await t.run((ctx) => ctx.db.insert("users", { phoneNumber }));
}

async function requestSignin(t: TestConvex, phoneNumber: string) {
  return t.mutation(api.phone_auth.requestPhoneAuthOtp, {
    _audit: await signedAudit(),
    phoneNumber,
    intent: "signin",
  });
}

function scheduledCount(t: TestConvex) {
  return t.run(
    async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect()).length,
  );
}

describe("account existence and the per-IP cap", () => {
  afterEach(() => {
    delete process.env.REVIEW_PHONES;
    delete process.env.REVIEW_CODE;
  });

  // Unknown numbers: one per request, so the per-number cap never applies.
  const unknownPhone = (i: number) => `+3361000${String(i).padStart(4, "0")}`;

  // Uniform answer: an anonymous caller can't tell a number has no account,
  // and no WhatsApp message goes to it.
  it("answers an unknown number on sign-in like a known one, sending nothing", async () => {
    const t = makeT();
    await expect(requestSignin(t, REAL_PHONE)).resolves.toEqual({
      sent: true,
    });
    expect(await scheduledCount(t)).toBe(0);
  });

  // Only an attested app (M09-9) learns that a number is taken.
  it("answers a taken number on sign-up instead of throwing", async () => {
    const t = makeT();
    await seedPhoneUser(t, REAL_PHONE);
    await t.run((ctx) =>
      ctx.db.insert("signup_attestations", {
        phoneNumber: REAL_PHONE,
        platform: "ios",
        expiresAt: Date.now() + 60_000,
      }),
    );
    await expect(
      t.mutation(api.phone_auth.requestPhoneAuthOtp, {
        phoneNumber: REAL_PHONE,
        intent: "signup",
        _audit: await signedAudit(),
      }),
    ).resolves.toEqual({
      sent: false,
      error:
        "An account with this phone number already exists. Sign in instead.",
    });
  });

  it("caps requests per IP, unknown numbers included", async () => {
    const t = makeT();
    for (let i = 0; i < CODE_REQUESTS_PER_IP; i++) {
      await expect(requestSignin(t, unknownPhone(i))).resolves.toEqual({
        sent: true,
      });
    }
    await expect(
      requestSignin(t, unknownPhone(CODE_REQUESTS_PER_IP)),
    ).rejects.toThrow("Too many requests");
  });

  it("leaves review numbers out of the IP cap: they send no WhatsApp", async () => {
    const REVIEW_PHONE = "+33600000009";
    process.env.REVIEW_PHONES = REVIEW_PHONE;
    process.env.REVIEW_CODE = "482913";
    const t = makeT();
    await seedPhoneUser(t, REVIEW_PHONE);
    for (let i = 0; i < CODE_REQUESTS_PER_IP; i++) {
      await requestSignin(t, unknownPhone(i));
    }
    await expect(requestSignin(t, REVIEW_PHONE)).resolves.toEqual({
      sent: true,
    });
  });
});

describe("dev test phone numbers", () => {
  afterEach(() => {
    delete process.env.DEV_TEST_PHONES;
  });

  it("accepts 000000 for a listed number without sending WhatsApp", async () => {
    process.env.DEV_TEST_PHONES = `+33600000002, ${TEST_PHONE}`;
    const t = makeT();
    await seedPhoneUser(t, TEST_PHONE);
    await requestSignin(t, TEST_PHONE);
    expect(await scheduledCount(t)).toBe(0);
    await expect(
      t.mutation(internal.phone_auth.consumePhoneAuthCode, {
        phoneNumber: TEST_PHONE,
        code: "000000",
        intent: "signin",
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("keeps unlisted numbers on WhatsApp with a random code", async () => {
    process.env.DEV_TEST_PHONES = TEST_PHONE;
    const t = makeT();
    await seedPhoneUser(t, REAL_PHONE);
    await requestSignin(t, REAL_PHONE);
    expect(await scheduledCount(t)).toBe(1);
  });

  it("ignores the fixed code when no test numbers are configured", async () => {
    const t = makeT();
    await seedPhoneUser(t, TEST_PHONE);
    await requestSignin(t, TEST_PHONE);
    expect(await scheduledCount(t)).toBe(1);
  });
});

describe("store review phone numbers", () => {
  const REVIEW_PHONE = "+33600000009";

  afterEach(() => {
    delete process.env.REVIEW_PHONES;
    delete process.env.REVIEW_CODE;
  });

  it("signs a listed number in with REVIEW_CODE, without WhatsApp", async () => {
    process.env.REVIEW_PHONES = REVIEW_PHONE;
    process.env.REVIEW_CODE = "482913";
    const t = makeT();
    await seedPhoneUser(t, REVIEW_PHONE);
    await requestSignin(t, REVIEW_PHONE);
    expect(await scheduledCount(t)).toBe(0);
    await expect(
      t.mutation(internal.phone_auth.consumePhoneAuthCode, {
        phoneNumber: REVIEW_PHONE,
        code: "482913",
        intent: "signin",
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("signs a spare listed number up with REVIEW_CODE once the app has attested", async () => {
    process.env.REVIEW_PHONES = REVIEW_PHONE;
    process.env.REVIEW_CODE = "482913";
    const t = makeT();
    await t.run((ctx) =>
      ctx.db.insert("signup_attestations", {
        phoneNumber: REVIEW_PHONE,
        platform: "ios",
        expiresAt: Date.now() + 60_000,
      }),
    );
    await t.mutation(api.phone_auth.requestPhoneAuthOtp, {
      _audit: await signedAudit(),
      phoneNumber: REVIEW_PHONE,
      intent: "signup",
    });
    expect(await scheduledCount(t)).toBe(0);
    await expect(
      t.mutation(internal.phone_auth.consumePhoneAuthCode, {
        phoneNumber: REVIEW_PHONE,
        code: "482913",
        intent: "signup",
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("still needs the app's attestation to sign a review number up", async () => {
    process.env.REVIEW_PHONES = REVIEW_PHONE;
    process.env.REVIEW_CODE = "482913";
    const t = makeT();
    await expect(
      t.mutation(api.phone_auth.requestPhoneAuthOtp, {
        _audit: await signedAudit(),
        phoneNumber: REVIEW_PHONE,
        intent: "signup",
      }),
    ).rejects.toThrow(SIGNUP_ATTESTATION_REQUIRED);
  });

  it("lets a reviewer request codes past the hourly cap, since none goes out on WhatsApp", async () => {
    process.env.REVIEW_PHONES = REVIEW_PHONE;
    process.env.REVIEW_CODE = "482913";
    const t = makeT();
    await seedPhoneUser(t, REVIEW_PHONE);
    for (let i = 0; i < 6; i++) await requestSignin(t, REVIEW_PHONE);
    expect(await scheduledCount(t)).toBe(0);
    await expect(
      t.mutation(internal.phone_auth.consumePhoneAuthCode, {
        phoneNumber: REVIEW_PHONE,
        code: "482913",
        intent: "signin",
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("still caps wrong guesses at the fixed review code per hour", async () => {
    process.env.REVIEW_PHONES = REVIEW_PHONE;
    process.env.REVIEW_CODE = "482913";
    const t = makeT();
    await seedPhoneUser(t, REVIEW_PHONE);
    const guessWrong = () =>
      t.mutation(internal.phone_auth.consumePhoneAuthCode, {
        phoneNumber: REVIEW_PHONE,
        code: "000001",
        intent: "signin",
      });
    // Three codes' worth of wrong guesses, as for a WhatsApp number.
    for (let code = 0; code < 3; code++) {
      await requestSignin(t, REVIEW_PHONE);
      for (let guess = 0; guess < OTP_MAX_ATTEMPTS; guess++) {
        await expect(guessWrong()).resolves.toEqual({
          ok: false,
          error: INVALID_CODE,
        });
      }
      await expect(guessWrong()).rejects.toThrow("Too many attempts");
    }
    await expect(requestSignin(t, REVIEW_PHONE)).rejects.toThrow(
      "Too many verification attempts",
    );
  });

  it("falls back to WhatsApp when REVIEW_CODE is missing or not 6 digits", async () => {
    process.env.REVIEW_PHONES = REVIEW_PHONE;
    for (const code of [undefined, "1234", "abcdef"]) {
      if (code === undefined) delete process.env.REVIEW_CODE;
      else process.env.REVIEW_CODE = code;
      const t = makeT();
      await seedPhoneUser(t, REVIEW_PHONE);
      await requestSignin(t, REVIEW_PHONE);
      expect(await scheduledCount(t)).toBe(1);
    }
  });
});

// The sign-in code request is public. The app seals the caller's IP
// (`_audit`): it is throttled per IP and per (number, IP), so nobody can
// make every number receive codes or use up the owner's own budget.
describe("sign-in code request limits", () => {
  const TOO_MANY = "Too many verification attempts";

  function requestFrom(t: TestConvex, phoneNumber: string, ip: string) {
    return signedAuditFrom(ip).then((_audit) =>
      t.mutation(api.phone_auth.requestPhoneAuthOtp, {
        phoneNumber,
        intent: "signin",
        _audit,
      }),
    );
  }

  it("throttles one caller across numbers, unknown ones included", async () => {
    const t = makeT();
    for (let n = 0; n < 10; n++) {
      await requestFrom(t, `+3361234560${n}`, "10.0.0.1");
    }

    await expect(requestFrom(t, "+33612345699", "10.0.0.1")).rejects.toThrow(
      "Too many requests",
    );
  });

  it("does not let one caller use up a number's codes", async () => {
    const t = makeT();
    await seedPhoneUser(t, REAL_PHONE);
    for (let i = 0; i < 3; i++) await requestFrom(t, REAL_PHONE, "10.0.0.1");
    await expect(requestFrom(t, REAL_PHONE, "10.0.0.1")).rejects.toThrow(
      TOO_MANY,
    );

    // The owner, from their own connection, still gets a code.
    await expect(requestFrom(t, REAL_PHONE, "10.0.0.2")).resolves.toEqual({
      sent: true,
    });
  });
});
