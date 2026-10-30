import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import { asUser, makeT } from "./test.helpers";

// `viewer` reaches every session of the account, step-up or not. It returns
// an explicit allowlist, so a server-only field added to `users` later never
// leaks by default (as the 24-word verifiers once did).

const VIEWER_FIELDS = [
  "_creationTime",
  "_id",
  "avatarUrl",
  "birthday",
  "country",
  "email",
  "emailVerificationTime",
  "encryptedAsymmetricSecretKey",
  "encryptedAsymmetricSecretKeyPrev",
  "encryptedIdentitySecretKey",
  "encryptedKeyBundle",
  "encryptedRetiredSecretKeys",
  "hiddenCategoryGroups",
  "identityPublicKey",
  "language",
  "masterKeyRotationRequired",
  "name",
  "phoneNumber",
  "phoneNumberVerifiedAt",
  "phraseSalt",
  "plan",
  "publicKey",
  "publicKeySignature",
  "recoveryVerified",
  "timezone",
];

describe("users.viewer", () => {
  it("returns only the allowlisted fields", async () => {
    const t = makeT();
    const now = Date.now();
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "ada@example.com",
        emailVerificationTime: now,
        name: "Ada",
        avatarUrl: "https://example.com/a.png",
        phoneNumber: "+33612345678",
        phoneNumberVerifiedAt: now,
        timezone: "Europe/Paris",
        language: "fr-FR",
        hiddenCategoryGroups: [],
        authProviders: ["phone"],
        publicKey: "pk",
        encryptedKeyBundle: "bundle",
        encryptedAsymmetricSecretKey: "sk",
        encryptedAsymmetricSecretKeyPrev: "sk-prev",
        encryptedRetiredSecretKeys: "sk-retired",
        identityPublicKey: "ipk",
        encryptedIdentitySecretKey: "isk",
        publicKeySignature: "sig",
        phraseSalt: "salt",
        recoveryPhraseHash: "verifier",
        cloudBackupOffAt: now,
        recoveryVerified: true,
        masterKeyRotationRequired: true,
        socialRecoveryRenewalRequired: true,
        deletionScheduledAt: now,
        totpResetVerifierHash: "totp-verifier",
        birthday: 0,
        country: "FR",
        legalInfoConfirmedAt: now,
        onboardingStep: "complete",
        welcomeSentAt: now,
        updatedAt: now,
        lastSeenAt: now,
        plan: "free",
        stripeCustomerId: "cus_1",
        role: "admin",
      }),
    );

    const viewer = await asUser(t, userId).query(api.users.viewer, {});

    expect(Object.keys(viewer ?? {}).sort()).toEqual(VIEWER_FIELDS);
  });
});
