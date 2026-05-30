import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import { makeT, seedUser, asUser, signedAudit } from "./test.helpers";

describe("setPublicKey — identity key fields (finding #2, step 1)", () => {
  it("persists the ML-KEM keypair plus the 3 identity fields", async () => {
    const t = makeT();
    const owner = await seedUser(t);

    await asUser(t, owner).mutation(api.users.setPublicKey, {
      publicKey: "ml-kem-public-key",
      encryptedAsymmetricSecretKey: "wrapped-ml-kem-secret",
      identityPublicKey: "ml-dsa-public-key",
      encryptedIdentitySecretKey: "wrapped-ml-dsa-secret",
      publicKeySignature: "ml-dsa-signature-over-ml-kem-pubkey",
      _audit: await signedAudit(),
    });

    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.publicKey).toBe("ml-kem-public-key");
    expect(user?.encryptedAsymmetricSecretKey).toBe("wrapped-ml-kem-secret");
    expect(user?.identityPublicKey).toBe("ml-dsa-public-key");
    expect(user?.encryptedIdentitySecretKey).toBe("wrapped-ml-dsa-secret");
    expect(user?.publicKeySignature).toBe(
      "ml-dsa-signature-over-ml-kem-pubkey",
    );
  });

  it("still works without identity fields (backward compatible)", async () => {
    const t = makeT();
    const owner = await seedUser(t);

    await asUser(t, owner).mutation(api.users.setPublicKey, {
      publicKey: "ml-kem-public-key",
      encryptedAsymmetricSecretKey: "wrapped-ml-kem-secret",
      _audit: await signedAudit(),
    });

    const user = await t.run((ctx) => ctx.db.get(owner));
    expect(user?.publicKey).toBe("ml-kem-public-key");
    expect(user?.identityPublicKey).toBeUndefined();
    expect(user?.encryptedIdentitySecretKey).toBeUndefined();
    expect(user?.publicKeySignature).toBeUndefined();
  });

  it("rejects a different ML-KEM public key once one is set", async () => {
    const t = makeT();
    const owner = await seedUser(t);
    await t.run((ctx) =>
      ctx.db.patch(owner, { publicKey: "existing-public-key" }),
    );

    await expect(
      asUser(t, owner).mutation(api.users.setPublicKey, {
        publicKey: "a-different-public-key",
        encryptedAsymmetricSecretKey: "wrapped-ml-kem-secret",
        identityPublicKey: "ml-dsa-public-key",
        encryptedIdentitySecretKey: "wrapped-ml-dsa-secret",
        publicKeySignature: "sig",
        _audit: await signedAudit(),
      }),
    ).rejects.toThrow();
  });
});
