import { afterEach, describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import { SIGNUP_ATTESTATION_REQUIRED } from "../attestation";
import { LEGACY_HOURLY_MAX } from "../phone_auth";
import { makeT, signedAuditFrom, type TestConvex } from "./test.helpers";

const TEST_PHONE = "+33600000001";
const REAL_PHONE = "+33612345678";

async function seedPhoneUser(t: TestConvex, phoneNumber: string) {
  await t.run((ctx) => ctx.db.insert("users", { phoneNumber }));
}

function requestSignin(t: TestConvex, phoneNumber: string) {
  return t.mutation(api.phone_auth.requestPhoneAuthOtp, {
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
        phoneNumber: REVIEW_PHONE,
        intent: "signup",
      }),
    ).rejects.toThrow(SIGNUP_ATTESTATION_REQUIRED);
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

// The sign-in code request is public. Current app builds seal the caller's
// IP (`_audit`): they are throttled per IP and per (number, IP), so nobody
// can make every number receive codes or use up the owner's own budget.
// Builds that predate `_audit` keep working on a per-number budget under a
// global hourly ceiling.
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

  it("keeps the owner's current app working when old builds flood the number", async () => {
    const t = makeT();
    await seedPhoneUser(t, REAL_PHONE);
    for (let i = 0; i < 3; i++) await requestSignin(t, REAL_PHONE);
    await expect(requestSignin(t, REAL_PHONE)).rejects.toThrow(TOO_MANY);

    await expect(requestFrom(t, REAL_PHONE, "10.0.0.2")).resolves.toEqual({
      sent: true,
    });
  });

  it("caps codes sent to old builds across all numbers per hour", async () => {
    const t = makeT();
    const phone = (n: number) => `+336${String(n).padStart(8, "0")}`;
    await t.run(async (ctx) => {
      for (let n = 0; n <= LEGACY_HOURLY_MAX; n++) {
        await ctx.db.insert("users", { phoneNumber: phone(n) });
      }
    });
    for (let n = 0; n < LEGACY_HOURLY_MAX; n++) {
      await requestSignin(t, phone(n));
    }

    await expect(requestSignin(t, phone(LEGACY_HOURLY_MAX))).rejects.toThrow(
      TOO_MANY,
    );
  });
});
