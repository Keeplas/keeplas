import { afterEach, describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import { makeT, type TestConvex } from "./test.helpers";

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
