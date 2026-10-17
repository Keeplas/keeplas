// Native ML-KEM-768 / ML-DSA-65 engines backed by react-native-quick-crypto
// (OpenSSL 3.5+). @noble/post-quantum is pure synchronous JS and blocks the
// Hermes JS thread for hundreds of milliseconds per operation; these engines
// move the math to native OpenSSL instead.
//
// Byte-for-byte compatibility: keys, ciphertexts, shared secrets and
// signatures keep exactly the raw FIPS 203 / FIPS 204 formats produced by
// noble (ML-KEM-768: 1184 B public key, 2400 B expanded secret key, 1088 B
// ciphertext; ML-DSA-65: 1952 B public key, 4032 B expanded secret key,
// 3309 B signature). OpenSSL only imports DER, so a deterministic ASN.1
// wrapper (SPKI for public keys, PKCS#8 "expandedKey" for secret keys, per
// draft-ietf-lamps-{kyber,dilithium}-certificates) is added around the raw
// bytes locally and never leaves this module. Nothing stored or sent over
// the network changes. Cross-compat with noble is asserted at runtime by
// self-test.ts.
import {
  KeyObject,
  KFormatType,
  KeyEncoding,
  MlKem,
  createSign,
  createVerify,
} from "react-native-quick-crypto";
import { ML_KEM_PARAMS, type MlKemImplementation } from "@keeplas/crypto/kem";
import { ML_DSA_PARAMS, type MlDsaImplementation } from "@keeplas/crypto/sig";

// DER-encoded OBJECT IDENTIFIERs (NIST algorithm arc, tag + length included).
// ML-KEM-768 = 2.16.840.1.101.3.4.4.2, ML-DSA-65 = 2.16.840.1.101.3.4.3.18.
const ML_KEM_768_OID = new Uint8Array([
  0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x04, 0x02,
]);
const ML_DSA_65_OID = new Uint8Array([
  0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x03, 0x12,
]);

/** DER TLV for lengths < 64 KiB (all fixed PQ key sizes fit). */
function derTlv(tag: number, ...contents: Uint8Array[]): Uint8Array {
  const len = contents.reduce((n, c) => n + c.length, 0);
  let header: number[];
  if (len < 0x80) header = [tag, len];
  else if (len < 0x100) header = [tag, 0x81, len];
  else header = [tag, 0x82, len >> 8, len & 0xff];
  const out = new Uint8Array(header.length + len);
  out.set(header, 0);
  let offset = header.length;
  for (const c of contents) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** SubjectPublicKeyInfo DER around a raw public key. */
function spkiFromRaw(oid: Uint8Array, rawPublicKey: Uint8Array): Uint8Array {
  const bitStringContent = new Uint8Array(rawPublicKey.length + 1);
  bitStringContent.set(rawPublicKey, 1); // leading 0x00 = no unused bits
  return derTlv(0x30, derTlv(0x30, oid), derTlv(0x03, bitStringContent));
}

/**
 * PKCS#8 DER around a raw *expanded* secret key (the "expandedKey OCTET
 * STRING" private-key choice — the only form derivable from the noble keys
 * the app stores, which carry no seed).
 */
function pkcs8FromRawExpanded(
  oid: Uint8Array,
  rawSecretKey: Uint8Array,
): Uint8Array {
  return derTlv(
    0x30,
    new Uint8Array([0x02, 0x01, 0x00]), // Version INTEGER 0
    derTlv(0x30, oid),
    derTlv(0x04, derTlv(0x04, rawSecretKey)),
  );
}

/** Copy a Uint8Array into a standalone ArrayBuffer for the Nitro bridge. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.length);
  new Uint8Array(buf).set(bytes);
  return buf;
}

function expectLength(bytes: Uint8Array, expected: number, what: string) {
  if (bytes.length !== expected) {
    throw new Error(`${what} must be exactly ${expected} bytes`);
  }
}

/**
 * ML-KEM-768 on OpenSSL. encapsulate/decapsulate run on a native background
 * thread (Nitro Promise), so the JS thread stays free.
 */
export const nativeMlKem: MlKemImplementation = {
  async encapsulate(publicKey) {
    expectLength(publicKey, ML_KEM_PARAMS.publicKeyBytes, "Public key");
    const kem = new MlKem("ML-KEM-768");
    kem.setPublicKey(
      toArrayBuffer(spkiFromRaw(ML_KEM_768_OID, publicKey)),
      KFormatType.DER,
      KeyEncoding.SPKI,
    );
    const { ciphertext, sharedKey } = await kem.encapsulate();
    const cipherText = new Uint8Array(ciphertext);
    const sharedSecret = new Uint8Array(sharedKey);
    expectLength(cipherText, ML_KEM_PARAMS.ciphertextBytes, "KEM ciphertext");
    expectLength(
      sharedSecret,
      ML_KEM_PARAMS.sharedSecretBytes,
      "Shared secret",
    );
    return { cipherText, sharedSecret };
  },
  async decapsulate(cipherText, secretKey) {
    expectLength(cipherText, ML_KEM_PARAMS.ciphertextBytes, "KEM ciphertext");
    expectLength(secretKey, ML_KEM_PARAMS.secretKeyBytes, "Secret key");
    const kem = new MlKem("ML-KEM-768");
    const der = pkcs8FromRawExpanded(ML_KEM_768_OID, secretKey);
    try {
      kem.setPrivateKey(toArrayBuffer(der), KFormatType.DER, KeyEncoding.PKCS8);
    } finally {
      der.fill(0);
    }
    const sharedSecret = new Uint8Array(
      await kem.decapsulate(toArrayBuffer(cipherText)),
    );
    expectLength(
      sharedSecret,
      ML_KEM_PARAMS.sharedSecretBytes,
      "Shared secret",
    );
    return sharedSecret;
  },
};

/**
 * ML-DSA-65 on OpenSSL. quick-crypto's async MlDsa object cannot import
 * existing keys, so this uses the synchronous Sign/Verify JSI handles (the
 * same path quick-crypto's own subtle.sign uses for ML-DSA; the empty
 * algorithm string selects pure, non-prehashed FIPS 204 signing with an
 * empty context — exactly what noble computes). The call blocks the JS
 * thread only for the ~1 ms native computation instead of noble's
 * JS-interpreted run.
 */
export const nativeMlDsa: MlDsaImplementation = {
  async sign(message, secretKey) {
    expectLength(secretKey, ML_DSA_PARAMS.secretKeyBytes, "Secret key");
    const der = pkcs8FromRawExpanded(ML_DSA_65_OID, secretKey);
    let keyObject: KeyObject;
    try {
      keyObject = KeyObject.createKeyObject(
        "private",
        toArrayBuffer(der),
        KFormatType.DER,
        KeyEncoding.PKCS8,
      );
    } finally {
      der.fill(0);
    }
    const signer = createSign("");
    signer.update(toArrayBuffer(message));
    const sig = signer.sign(keyObject);
    const signature = new Uint8Array(
      sig.buffer,
      sig.byteOffset,
      sig.length,
    ).slice();
    expectLength(signature, ML_DSA_PARAMS.signatureBytes, "Signature");
    return signature;
  },
  async verify(signature, message, publicKey) {
    expectLength(publicKey, ML_DSA_PARAMS.publicKeyBytes, "Public key");
    const keyObject = KeyObject.createKeyObject(
      "public",
      toArrayBuffer(spkiFromRaw(ML_DSA_65_OID, publicKey)),
      KFormatType.DER,
      KeyEncoding.SPKI,
    );
    const verifier = createVerify("");
    verifier.update(toArrayBuffer(message));
    return verifier.verify(keyObject, toArrayBuffer(signature));
  },
};
