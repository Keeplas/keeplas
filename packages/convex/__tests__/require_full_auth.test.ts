import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import {
  makeT,
  seedUser,
  asUser,
  asUserSession,
  seedSession,
  seedPasswordAccount,
  clearLoginOtp,
  seedVerifiedTotp,
  clearTotp,
  signedAudit,
  type TestConvex,
} from "./test.helpers";
import type { Id } from "../_generated/dataModel";

// Finding #1: the always-on login-OTP step-up and the TOTP gate were defined
// (`requireAuthWithLoginOtp` / `requireAuthWithTotp`) but never wired into any
// sensitive handler — every owner query/mutation used plain `requireAuth`. An
// authenticated session that never cleared OTP/TOTP could call the API
// directly and read ciphertext/metadata or invoke sensitive mutations.
//
// `requireFullAuth` composes both gates and is now applied to steady-state
// sensitive owner operations. These tests pin the contract:
//   (a) a password-account session that has NOT cleared login-OTP is blocked,
//   (b) the same op succeeds once the session has the cleared row(s),
//   (c) a passwordless (phone-otp) account is NOT double-gated,
//   (d) onboarding/first-run setup is unaffected.

/** Seed a fully-formed vault row so createItem can read + patch it. */
async function seedVault(
  t: TestConvex,
  userId: Id<"users">,
): Promise<Id<"vaults">> {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("vaults", {
      userId,
      encryptedItemsCount: 0,
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

describe("requireFullAuth — login-OTP gate on sensitive ops", () => {
  it("(a) BLOCKS a sensitive read for a password session that has not cleared login-OTP", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await seedPasswordAccount(t, userId);
    const sessionId = await seedSession(t, userId);

    // No `auth_session_login_otp` row → gate not cleared.
    await expect(
      asUserSession(t, userId, sessionId).query(api.vault_items.getItems, {}),
    ).rejects.toThrow("LOGIN_OTP_REQUIRED");
  });

  it("(a) BLOCKS a sensitive mutation for an un-stepped-up password session", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await seedPasswordAccount(t, userId);
    const sessionId = await seedSession(t, userId);
    const vaultId = await seedVault(t, userId);

    await expect(
      asUserSession(t, userId, sessionId).mutation(api.vault_items.createItem, {
        vaultId,
        category: "personal_document",
        title: "Secret",
        encryptedContent: JSON.stringify({
          ciphertext: "Y2lwaA==",
          iv: "aXY=",
        }),
        accessLevel: "private",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow("LOGIN_OTP_REQUIRED");
  });

  it("(b) SUCCEEDS once the password session has cleared login-OTP", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await seedPasswordAccount(t, userId);
    const sessionId = await seedSession(t, userId);
    await clearLoginOtp(t, userId, sessionId);

    const items = await asUserSession(t, userId, sessionId).query(
      api.vault_items.getItems,
      {},
    );
    expect(items).toEqual([]);

    const vaultId = await seedVault(t, userId);
    const itemId = (await asUserSession(t, userId, sessionId).mutation(
      api.vault_items.createItem,
      {
        vaultId,
        category: "personal_document",
        title: "Secret",
        encryptedContent: JSON.stringify({
          ciphertext: "Y2lwaA==",
          iv: "aXY=",
        }),
        accessLevel: "private",
        _audit: await signedAudit(),
      },
    )) as Id<"vault_items">;
    const stored = await t.run((ctx) => ctx.db.get(itemId));
    expect(stored?.title).toBe("Secret");
  });

  it("(c) does NOT double-gate a passwordless (phone-otp) account", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    // No password account → the login-OTP gate must not apply, even with no
    // cleared row. Use the default `asUser` (its session has no gate rows).
    const items = await asUser(t, userId).query(api.vault_items.getItems, {});
    expect(items).toEqual([]);
  });
});

describe("requireFullAuth — TOTP gate when enrolled", () => {
  it("BLOCKS when TOTP is enrolled but the session has not cleared it", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    // Passwordless account (login-OTP skipped) so we isolate the TOTP gate.
    const sessionId = await seedSession(t, userId);
    await seedVerifiedTotp(t, userId);

    await expect(
      asUserSession(t, userId, sessionId).query(api.vault_items.getItems, {}),
    ).rejects.toThrow("TOTP_REQUIRED");
  });

  it("SUCCEEDS once both login-OTP and TOTP are cleared for a password+TOTP account", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await seedPasswordAccount(t, userId);
    const sessionId = await seedSession(t, userId);
    await seedVerifiedTotp(t, userId);
    await clearLoginOtp(t, userId, sessionId);
    await clearTotp(t, userId, sessionId);

    const items = await asUserSession(t, userId, sessionId).query(
      api.vault_items.getItems,
      {},
    );
    expect(items).toEqual([]);
  });

  it("still BLOCKS on TOTP when login-OTP is cleared but TOTP is not", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await seedPasswordAccount(t, userId);
    const sessionId = await seedSession(t, userId);
    await seedVerifiedTotp(t, userId);
    await clearLoginOtp(t, userId, sessionId);
    // TOTP enrolled + verified but NOT cleared for this session.

    await expect(
      asUserSession(t, userId, sessionId).query(api.vault_items.getItems, {}),
    ).rejects.toThrow("TOTP_REQUIRED");
  });
});

describe("requireFullAuth — onboarding/setup is NOT gated (d)", () => {
  it("a fresh password account can run onboarding mutations without clearing the gate", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await seedPasswordAccount(t, userId);
    const sessionId = await seedSession(t, userId);
    // Deliberately NO cleared login-OTP row: onboarding runs before the gate
    // is necessarily credited (creditSignupSession is best-effort + TTL-bound).

    await asUserSession(t, userId, sessionId).mutation(
      api.onboarding.initOnboarding,
      {},
    );
    await asUserSession(t, userId, sessionId).mutation(
      api.onboarding.advanceOnboardingStep,
      { step: "recovery_phrase" },
    );
    const state = await asUserSession(t, userId, sessionId).query(
      api.onboarding.getOnboardingState,
      {},
    );
    expect(state?.onboardingStep).toBe("recovery_phrase");
  });

  it("storeKeyBundle (final onboarding step) works without the gate cleared", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    await seedPasswordAccount(t, userId);
    const sessionId = await seedSession(t, userId);

    await asUserSession(t, userId, sessionId).mutation(
      api.onboarding.storeKeyBundle,
      {
        encryptedKeyBundle: "bundle",
        phraseSalt: "salt",
        vaultThreshold: 2,
      },
    );
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.onboardingStep).toBe("complete");
  });
});
