import { base64ToUint8, uint8ToBase64 } from "@keeplas/crypto/encoding";

export async function exportMasterKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}

export async function importMasterKey(raw: Uint8Array): Promise<CryptoKey> {
  const buf = new Uint8Array(raw.byteLength);
  buf.set(raw);
  return crypto.subtle.importKey(
    "raw",
    buf,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function importWrapKeyFromBytes(
  raw: Uint8Array
): Promise<CryptoKey> {
  const buf = new Uint8Array(raw.byteLength);
  buf.set(raw);
  return crypto.subtle.importKey(
    "raw",
    buf,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function wrapWithKey(
  raw: Uint8Array,
  wrapKey: CryptoKey
): Promise<{ iv: string; wrapped: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = new Uint8Array(raw.byteLength);
  buf.set(raw);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    wrapKey,
    buf
  );
  return { iv: uint8ToBase64(iv), wrapped: uint8ToBase64(new Uint8Array(ct)) };
}

export async function unwrapWithKey(
  wrappedB64: string,
  ivB64: string,
  wrapKey: CryptoKey
): Promise<Uint8Array> {
  const ct = base64ToUint8(wrappedB64);
  const iv = base64ToUint8(ivB64);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    wrapKey,
    ct
  );
  return new Uint8Array(pt);
}
