import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { sha256Hex } from "../lib/crypto";
import {
  asUserSession,
  clearLoginOtp,
  makeT,
  seedPasswordAccount,
  seedSession,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

// Phase 4 (D5, M09-7 / M09-8): an existing email + password account adds a
// phone and a passkey, installs the app, then password sign-in is refused.

const PHONE = "+33612345678";

async function seedEmailAccount(t: TestConvex) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "ada@example.com",
      authProviders: ["email", "totp"],
    }),
  );
  await seedPasswordAccount(t, userId);
  const sessionId = await seedSession(t, userId);
  await clearLoginOtp(t, userId, sessionId);
  return { userId, sessionId, as: asUserSession(t, userId, sessionId) };
}

async function verifyPhone(
  t: TestConvex,
  userId: Id<"users">,
  as: ReturnType<typeof asUserSession>,
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("phone_verification_codes", {
      userId,
      phoneNumber: PHONE,
      codeHash: await sha256Hex("123456"),
      expiresAt: Date.now() + 60_000,
      attempts: 0,
    });
  });
  await as.mutation(api.phone_verification.verifyCode, {
    code: "123456",
    _audit: await signedAudit(),
  });
}

async function addPasskey(t: TestConvex, userId: Id<"users">) {
  const now = Date.now();
  await t.run((ctx) =>
    ctx.db.insert("passkey_credentials", {
      userId,
      credentialId: "cred",
      publicKey: "pk",
      counter: 0,
      deviceName: "iPhone",
      createdAt: now,
      lastUsedAt: now,
    }),
  );
}

async function installApp(as: ReturnType<typeof asUserSession>) {
  await as.mutation(api.devices.register, {
    kind: "ios",
    label: "iPhone 15",
    trusted: true,
    _audit: await signedAudit(),
  });
}

async function finalize(as: ReturnType<typeof asUserSession>) {
  return as.mutation(api.account_migration.finalize, {
    _audit: await signedAudit(),
  });
}

function accountsOf(t: TestConvex, userId: Id<"users">) {
  return t.run(async (ctx) =>
    (
      await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
        .collect()
    ).map((a) => a.provider),
  );
}

describe("email → phone migration", () => {
  it("tracks each step of the checklist", async () => {
    const t = makeT();
    const { userId, as } = await seedEmailAccount(t);
    expect(await as.query(api.account_migration.getStatus, {})).toEqual({
      needsMigration: true,
      phoneVerified: false,
      hasPasskey: false,
      hasMobileDevice: false,
    });
    await verifyPhone(t, userId, as);
    await addPasskey(t, userId);
    await installApp(as);
    expect(await as.query(api.account_migration.getStatus, {})).toEqual({
      needsMigration: true,
      phoneVerified: true,
      hasPasskey: true,
      hasMobileDevice: true,
    });
  });

  it("refuses to turn password sign-in off before every step is done", async () => {
    const t = makeT();
    const { userId, as } = await seedEmailAccount(t);
    await verifyPhone(t, userId, as);
    await addPasskey(t, userId);
    await expect(finalize(as)).rejects.toThrow("MIGRATION_STEPS_INCOMPLETE");
    expect(await accountsOf(t, userId)).toContain("password");
  });

  it("turns password sign-in off and ends the other sessions", async () => {
    const t = makeT();
    const { userId, sessionId, as } = await seedEmailAccount(t);
    const otherSession = await seedSession(t, userId);
    await verifyPhone(t, userId, as);
    await addPasskey(t, userId);
    await installApp(as);

    await finalize(as);

    // Password (and email-code) sign-in is refused: the accounts are gone.
    expect(await accountsOf(t, userId)).toEqual(["phone-otp"]);
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.email).toBe("ada@example.com");
    expect(user?.authProviders).toEqual(["phone", "passkey", "totp"]);
    expect(await t.run((ctx) => ctx.db.get(otherSession))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(sessionId))).not.toBeNull();
    expect(await as.query(api.account_migration.getStatus, {})).toMatchObject({
      needsMigration: false,
    });
  });
});
