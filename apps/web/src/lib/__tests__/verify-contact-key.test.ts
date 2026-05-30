import { describe, it, expect } from "vitest";
import {
  generateRecipientKeyPair,
  serializePublicKey,
  parsePublicKey,
} from "@keeplas/crypto/kem";
import {
  generateIdentityKeyPair,
  signBytes,
  identityKeyFingerprint,
} from "@keeplas/crypto/sig";
import { verifyContactKey } from "../verify-contact-key";

/**
 * Verify-before-wrap unit tests (finding #2). Exercises the real ML-KEM /
 * ML-DSA crypto so a tampered key is genuinely rejected, not just by string
 * comparison. Each `build*` produces the server-provided shape the client
 * consumes before wrapping a DEK/shard to a contact.
 */
function buildHonestContact() {
  const kem = generateRecipientKeyPair();
  const contactPublicKey = serializePublicKey(kem.publicKey);
  const identity = generateIdentityKeyPair();
  const contactPublicKeySignature = signBytes(
    identity.secretKey,
    parsePublicKey(contactPublicKey),
  );
  return {
    contactId: "c1",
    name: "Ada",
    contactPublicKey,
    contactIdentityPublicKey: identity.publicKey,
    contactPublicKeySignature,
  };
}

describe("verifyContactKey", () => {
  it("accepts a correctly signed key and returns the fingerprint to pin on first trust", async () => {
    const c = buildHonestContact();
    const outcome = await verifyContactKey(c);
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") throw new Error("unreachable");
    expect(outcome.contactPublicKey).toBe(c.contactPublicKey);
    // No pin yet → first-trust path hands back the fingerprint to persist.
    expect(outcome.pinFingerprint).toBe(
      await identityKeyFingerprint(c.contactIdentityPublicKey),
    );
  });

  it("accepts when the pin matches the identity key", async () => {
    const c = buildHonestContact();
    const fp = await identityKeyFingerprint(c.contactIdentityPublicKey);
    const outcome = await verifyContactKey({
      ...c,
      pinnedIdentityFingerprint: fp,
    });
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") throw new Error("unreachable");
    // Already pinned → no re-pin requested.
    expect(outcome.pinFingerprint).toBeUndefined();
  });

  it("BLOCKS (not skips) a server-substituted ML-KEM key — signature no longer verifies", async () => {
    const c = buildHonestContact();
    // Server swaps the encryption key for one whose secret it controls. The
    // signature was over the ORIGINAL key, so it now fails to verify.
    const attacker = generateRecipientKeyPair();
    const tampered = {
      ...c,
      contactPublicKey: serializePublicKey(attacker.publicKey),
    };
    const outcome = await verifyContactKey(tampered);
    expect(outcome.status).toBe("signature_invalid");
  });

  it("BLOCKS when the signature is mismatched / forged with the wrong identity key", async () => {
    const c = buildHonestContact();
    const otherIdentity = generateIdentityKeyPair();
    const forged = signBytes(
      otherIdentity.secretKey,
      parsePublicKey(c.contactPublicKey),
    );
    // Signature was made by a DIFFERENT identity key than the published one.
    const outcome = await verifyContactKey({
      ...c,
      contactPublicKeySignature: forged,
    });
    expect(outcome.status).toBe("signature_invalid");
  });

  it("BLOCKS as unverifiable when identity material is missing (legacy contact)", async () => {
    const kem = generateRecipientKeyPair();
    const outcome = await verifyContactKey({
      contactId: "legacy",
      contactPublicKey: serializePublicKey(kem.publicKey),
      // no identity public key / signature
    });
    expect(outcome.status).toBe("unverifiable");
  });

  it("BLOCKS with fingerprint_changed when the identity key changed vs the pin", async () => {
    const c = buildHonestContact();
    // Owner previously pinned a DIFFERENT identity key's fingerprint.
    const oldPin = await identityKeyFingerprint(
      generateIdentityKeyPair().publicKey,
    );
    const outcome = await verifyContactKey({
      ...c,
      pinnedIdentityFingerprint: oldPin,
    });
    expect(outcome.status).toBe("fingerprint_changed");
    if (outcome.status !== "fingerprint_changed")
      throw new Error("unreachable");
    // Carries the NEW fingerprint so the owner can review + explicitly re-pin.
    expect(outcome.newFingerprint).toBe(
      await identityKeyFingerprint(c.contactIdentityPublicKey),
    );
    expect(outcome.newFingerprint).not.toBe(oldPin);
  });
});
