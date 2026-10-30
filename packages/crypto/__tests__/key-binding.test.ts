import { describe, it, expect } from "vitest";
import {
  generateRecipientKeyPair,
  parsePublicKey,
  serializePublicKey,
} from "../src/kem";
import {
  generateIdentityKeyPair,
  signBytes,
  signKemBinding,
  verifyKemBinding,
} from "../src/sig";

/**
 * ML-KEM key binding: the identity key signs the encryption key with a
 * versioned label and the owner's userId (v1), while signatures made before
 * v1 (raw key bytes, v0) keep verifying for existing accounts.
 */
function keys() {
  return {
    identity: generateIdentityKeyPair(),
    kem: serializePublicKey(generateRecipientKeyPair().publicKey),
  };
}

describe("ML-KEM key binding", () => {
  it("verifies a v1 signature for the user it was made for", async () => {
    const { identity, kem } = keys();
    const signature = await signKemBinding(identity.secretKey, "u1", kem);
    expect(
      await verifyKemBinding({
        identityPublicKey: identity.publicKey,
        kemPublicKey: kem,
        signature,
        userId: "u1",
      }),
    ).toBe(1);
  });

  it("rejects a v1 signature presented for another user", async () => {
    const { identity, kem } = keys();
    const signature = await signKemBinding(identity.secretKey, "u1", kem);
    expect(
      await verifyKemBinding({
        identityPublicKey: identity.publicKey,
        kemPublicKey: kem,
        signature,
        userId: "u2",
      }),
    ).toBeNull();
  });

  it("does not sign the raw key bytes (no cross-protocol reuse)", async () => {
    const { identity, kem } = keys();
    const signature = await signKemBinding(identity.secretKey, "u1", kem);
    expect(
      await verifyKemBinding({
        identityPublicKey: identity.publicKey,
        kemPublicKey: kem,
        signature,
      }),
    ).toBeNull();
  });

  it("still verifies a legacy raw-bytes signature as v0", async () => {
    const { identity, kem } = keys();
    const signature = signBytes(identity.secretKey, parsePublicKey(kem));
    expect(
      await verifyKemBinding({
        identityPublicKey: identity.publicKey,
        kemPublicKey: kem,
        signature,
        userId: "u1",
      }),
    ).toBe(0);
  });

  it("rejects a signature over another ML-KEM key", async () => {
    const { identity, kem } = keys();
    const signature = await signKemBinding(identity.secretKey, "u1", kem);
    expect(
      await verifyKemBinding({
        identityPublicKey: identity.publicKey,
        kemPublicKey: keys().kem,
        signature,
        userId: "u1",
      }),
    ).toBeNull();
  });

  it("returns null on a malformed key instead of throwing", async () => {
    const { identity } = keys();
    expect(
      await verifyKemBinding({
        identityPublicKey: identity.publicKey,
        kemPublicKey: "not-a-key",
        signature: "AAAA",
        userId: "u1",
      }),
    ).toBeNull();
  });
});
