import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  makeT,
  seedUser,
  seedSession,
  seedTrustContact,
  asUser,
  asProvenUser,
  asPhoneProvenUser,
  signedAudit,
  type TestConvex,
} from "./test.helpers";

/** A user who finished onboarding (pre-rotation key material). */
async function seedOwner(t: TestConvex) {
  const owner = await seedUser(t);
  await t.run((ctx) =>
    ctx.db.patch(owner, {
      publicKey: "old-public-key",
      publicKeySignature: "old-signature",
      identityPublicKey: "old-identity",
      encryptedIdentitySecretKey: "old-identity-secret",
      encryptedKeyBundle: "old-bundle",
      encryptedAsymmetricSecretKey: "old-secret",
      phraseSalt: "old-salt",
      recoveryPhraseHash: "old-verifier",
    }),
  );
  return owner;
}

const rotateArgs = async (
  overrides: Partial<{
    categoryNames: { id: Id<"vault_categories">; encryptedName: string }[];
    folderNames: { id: Id<"folders">; encryptedName: string }[];
    contactPins: {
      contactId: Id<"trusted_contacts">;
      fingerprint: string;
      mac: string;
    }[];
  }> = {},
) => ({
  encryptedKeyBundle: "new-bundle",
  publicKey: "new-public-key",
  publicKeySignature: "new-signature",
  identityPublicKey: "new-identity-public-key",
  encryptedIdentitySecretKey: "new-identity-secret",
  encryptedAsymmetricSecretKey: "new-secret",
  encryptedAsymmetricSecretKeyPrev: "old-secret-rewrapped",
  encryptedRetiredSecretKeys: "retired-under-new",
  categoryNames: [],
  folderNames: [],
  contactPins: [],
  ...overrides,
  _audit: await signedAudit(),
});

const finalizeArgs = async () => ({
  encryptedRetiredSecretKeys: "retired-final",
  encryptedKeyBundle: "new-kit-bundle",
  phraseSalt: "new-salt",
  recoveryPhraseHash: "new-verifier",
  _audit: await signedAudit(),
});

describe("rotateKeyMaterial", () => {
  it("overwrites existing key material and stores the previous owner secret", async () => {
    const t = makeT();
    const owner = await seedOwner(t);

    const as = await asProvenUser(t, owner, "vault");
    await as.mutation(api.rotation.rotateKeyMaterial, await rotateArgs());

    const user = await t.run((ctx) => ctx.db.get(owner));
    // setPublicKey would reject this; rotation must overwrite.
    expect(user?.publicKey).toBe("new-public-key");
    expect(user?.encryptedKeyBundle).toBe("new-bundle");
    expect(user?.encryptedAsymmetricSecretKey).toBe("new-secret");
    expect(user?.encryptedAsymmetricSecretKeyPrev).toBe("old-secret-rewrapped");
    expect(user?.encryptedRetiredSecretKeys).toBe("retired-under-new");
    // Finding #2: the public-key signature must be re-persisted atomically with
    // the new key — never left stale, or contacts' verify-before-wrap fails.
    expect(user?.publicKeySignature).toBe("new-signature");
    expect(user?.identityPublicKey).toBe("new-identity-public-key");
    expect(user?.encryptedIdentitySecretKey).toBe("new-identity-secret");
  });

  it("needs the vault opened in this session, not only a WhatsApp code", async () => {
    // A number takeover passes the phone proof; replacing the identity key
    // must prove possession of the current one.
    const t = makeT();
    const owner = await seedOwner(t);
    const as = await asPhoneProvenUser(t, owner);
    await expect(
      as.mutation(api.rotation.rotateKeyMaterial, await rotateArgs()),
    ).rejects.toThrow("VAULT_PROOF_REQUIRED");
    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.publicKey).toBe("old-public-key");
  });

  it("refuses to start over while a rotation is in progress", async () => {
    // Overwriting Prev would drop the original owner secret for good.
    const t = makeT();
    const owner = await seedOwner(t);
    await t.run((ctx) =>
      ctx.db.patch(owner, { encryptedAsymmetricSecretKeyPrev: "sk0" }),
    );
    const as = await asProvenUser(t, owner, "vault");
    await expect(
      as.mutation(api.rotation.rotateKeyMaterial, await rotateArgs()),
    ).rejects.toThrow("ROTATION_IN_PROGRESS");
    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.encryptedAsymmetricSecretKeyPrev).toBe("sk0");
  });

  it("re-seals category and folder names with the key material", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const now = Date.now();
    const { categoryId, folderId } = await t.run(async (ctx) => ({
      categoryId: await ctx.db.insert("vault_categories", {
        userId: owner,
        encryptedName: "name-under-old",
        createdAt: now,
      }),
      folderId: await ctx.db.insert("folders", {
        userId: owner,
        encryptedName: "folder-under-old",
        createdAt: now,
        updatedAt: now,
      }),
    }));
    const as = await asProvenUser(t, owner, "vault");
    await as.mutation(
      api.rotation.rotateKeyMaterial,
      await rotateArgs({
        categoryNames: [{ id: categoryId, encryptedName: "name-under-new" }],
        folderNames: [{ id: folderId, encryptedName: "folder-under-new" }],
      }),
    );
    const [category, folder] = await t.run(async (ctx) => [
      await ctx.db.get(categoryId),
      await ctx.db.get(folderId),
    ]);
    expect(category?.encryptedName).toBe("name-under-new");
    expect(folder?.encryptedName).toBe("folder-under-new");
  });

  it("refuses when a category name is missing (it would be lost)", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    await t.run((ctx) =>
      ctx.db.insert("vault_categories", {
        userId: owner,
        encryptedName: "created-meanwhile",
        createdAt: Date.now(),
      }),
    );
    const as = await asProvenUser(t, owner, "vault");
    await expect(
      as.mutation(api.rotation.rotateKeyMaterial, await rotateArgs()),
    ).rejects.toThrow("NAMES_CHANGED");
    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.publicKey).toBe("old-public-key");
  });

  it("refuses another user's category", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const other = await seedUser(t);
    const categoryId = await t.run((ctx) =>
      ctx.db.insert("vault_categories", {
        userId: other,
        encryptedName: "theirs",
        createdAt: Date.now(),
      }),
    );
    const as = await asProvenUser(t, owner, "vault");
    await expect(
      as.mutation(
        api.rotation.rotateKeyMaterial,
        await rotateArgs({
          categoryNames: [{ id: categoryId, encryptedName: "overwritten" }],
        }),
      ),
    ).rejects.toThrow("NAMES_CHANGED");
    const category = await t.run((ctx) => ctx.db.get(categoryId));
    expect(category?.encryptedName).toBe("theirs");
  });

  it("re-MACs contact pins atomically but never changes a pinned identity", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const contactId = await seedTrustContact(t, owner, { n: 1 });
    await t.run((ctx) =>
      ctx.db.patch(contactId, {
        pinnedIdentityFingerprint: "fp",
        pinnedIdentityMac: "mac-under-old",
      }),
    );
    const as = await asProvenUser(t, owner, "vault");
    await expect(
      as.mutation(
        api.rotation.rotateKeyMaterial,
        await rotateArgs({
          contactPins: [{ contactId, fingerprint: "other-fp", mac: "m" }],
        }),
      ),
    ).rejects.toThrow("Contact identity is already pinned");

    await as.mutation(
      api.rotation.rotateKeyMaterial,
      await rotateArgs({
        contactPins: [{ contactId, fingerprint: "fp", mac: "mac-under-new" }],
      }),
    );
    const contact = await t.run((ctx) => ctx.db.get(contactId));
    expect(contact?.pinnedIdentityMac).toBe("mac-under-new");
  });

  it("ends every other session (stale devices stop writing to the old key)", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    const other = await seedSession(t, owner);
    const as = await asProvenUser(t, owner, "vault");
    await as.mutation(api.rotation.rotateKeyMaterial, await rotateArgs());
    const sessions = await t.run((ctx) =>
      ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", owner))
        .collect(),
    );
    expect(sessions.map((s) => s._id)).not.toContain(other);
    expect(sessions).toHaveLength(1);
  });

  it("lets a user who rotated before this change rotate again", async () => {
    // Legacy shape: an earlier (finalized) rotation left no Prev and no
    // retired-key archive.
    const t = makeT();
    const owner = await seedOwner(t);
    const as = await asProvenUser(t, owner, "vault");
    await as.mutation(api.rotation.rotateKeyMaterial, await rotateArgs());
    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.publicKey).toBe("new-public-key");
  });
});

describe("finalizeRotation", () => {
  it("archives the previous secret and retires the old 24 words", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    await t.run((ctx) =>
      ctx.db.patch(owner, {
        encryptedAsymmetricSecretKeyPrev: "old-secret-rewrapped",
        masterKeyRotationRequired: true,
        totpResetVerifierHash: "old-words-totp-verifier",
      }),
    );

    const as = await asProvenUser(t, owner, "vault");
    await as.mutation(api.rotation.finalizeRotation, await finalizeArgs());

    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.encryptedAsymmetricSecretKeyPrev).toBeUndefined();
    // The previous secret stays readable for wraps sealed to it (items
    // shared with this user, recovery shares, late writers).
    expect(user?.encryptedRetiredSecretKeys).toBe("retired-final");
    // New RootKey: a device or envelope holding the old one opens nothing.
    expect(user?.encryptedKeyBundle).toBe("new-kit-bundle");
    expect(user?.phraseSalt).toBe("new-salt");
    expect(user?.recoveryPhraseHash).toBe("new-verifier");
    expect(user?.totpResetVerifierHash).toBeUndefined();
    expect(user?.masterKeyRotationRequired).toBeUndefined();
  });

  it("finishes a rotation left half-done by an older app (legacy shape)", async () => {
    // Stuck mid-rotation before the archive existed: Prev set, no archive.
    // The phone resumes; finalize must take the archive, not drop Prev.
    const t = makeT();
    const owner = await seedOwner(t);
    await t.run((ctx) =>
      ctx.db.patch(owner, { encryptedAsymmetricSecretKeyPrev: "sk0" }),
    );
    const as = await asProvenUser(t, owner, "vault");
    await expect(
      as.mutation(api.rotation.rotateKeyMaterial, await rotateArgs()),
    ).rejects.toThrow("ROTATION_IN_PROGRESS");
    await as.mutation(api.rotation.finalizeRotation, await finalizeArgs());
    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.encryptedRetiredSecretKeys).toBe("retired-final");
    expect(user?.encryptedAsymmetricSecretKeyPrev).toBeUndefined();
  });

  it("refuses when no rotation is in progress", async () => {
    // It would clear a forced rotation without rotating anything.
    const t = makeT();
    const owner = await seedOwner(t);
    await t.run((ctx) =>
      ctx.db.patch(owner, { masterKeyRotationRequired: true }),
    );
    const as = await asProvenUser(t, owner, "vault");
    await expect(
      as.mutation(api.rotation.finalizeRotation, await finalizeArgs()),
    ).rejects.toThrow("NO_ROTATION_IN_PROGRESS");
    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.masterKeyRotationRequired).toBe(true);
  });

  it("needs a vault proof (it replaces the key bundle)", async () => {
    const t = makeT();
    const owner = await seedOwner(t);
    await t.run((ctx) =>
      ctx.db.patch(owner, { encryptedAsymmetricSecretKeyPrev: "sk0" }),
    );
    await expect(
      asUser(t, owner).mutation(
        api.rotation.finalizeRotation,
        await finalizeArgs(),
      ),
    ).rejects.toThrow("VAULT_PROOF_REQUIRED");
  });
});
