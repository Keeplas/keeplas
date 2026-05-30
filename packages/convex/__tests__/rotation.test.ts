import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import { makeT, seedUser, asUser, signedAudit } from "./test.helpers";

describe("rotateKeyMaterial", () => {
  it("overwrites existing key material and stores the previous owner secret", async () => {
    const t = makeT();
    const owner = await seedUser(t);

    // Pre-rotation state: a user who already finished onboarding.
    await t.run((ctx) =>
      ctx.db.patch(owner, {
        publicKey: "old-public-key",
        publicKeySignature: "old-signature",
        encryptedKeyBundle: "old-bundle",
        encryptedAsymmetricSecretKey: "old-secret",
      }),
    );

    await asUser(t, owner).mutation(api.rotation.rotateKeyMaterial, {
      encryptedKeyBundle: "new-bundle",
      publicKey: "new-public-key",
      publicKeySignature: "new-signature",
      encryptedAsymmetricSecretKey: "new-secret",
      encryptedAsymmetricSecretKeyPrev: "old-secret-rewrapped",
      _audit: await signedAudit(),
    });

    const user = await t.run((ctx) => ctx.db.get(owner));
    // setPublicKey would reject this; rotation must overwrite.
    expect(user?.publicKey).toBe("new-public-key");
    expect(user?.encryptedKeyBundle).toBe("new-bundle");
    expect(user?.encryptedAsymmetricSecretKey).toBe("new-secret");
    expect(user?.encryptedAsymmetricSecretKeyPrev).toBe("old-secret-rewrapped");
    // Finding #2: the public-key signature must be re-persisted atomically with
    // the new key — never left stale, or contacts' verify-before-wrap fails.
    expect(user?.publicKeySignature).toBe("new-signature");
  });
});

describe("finalizeRotation", () => {
  it("clears the transitional previous owner secret", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await t.run((ctx) =>
      ctx.db.patch(owner, {
        encryptedAsymmetricSecretKeyPrev: "old-secret-rewrapped",
      }),
    );

    await asUser(t, owner).mutation(api.rotation.finalizeRotation, {
      _audit: await signedAudit(),
    });

    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.encryptedAsymmetricSecretKeyPrev).toBeUndefined();
  });
});
