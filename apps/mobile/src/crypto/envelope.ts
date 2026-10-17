/**
 * Item-level symmetric crypto, byte-compatible with the web app
 * (apps/web/src/lib/use-vault-crypto.ts):
 *
 *   text  → JSON {ciphertext, iv} (base64), AES-256-GCM under a DEK or the
 *           MasterKey (titles, content, links, metadata, wrapped secrets)
 *   file  → single AES-GCM blob + base64 IV up to 8 MB; above, the chunked
 *           `encryptStream` format of @keeplas/crypto with IV "__stream__":
 *           1 MB chunks, each [12-byte IV][ciphertext + 16-byte tag], AAD =
 *           [u32 chunkIndex][u32 chunkCount] big-endian.
 *
 * Files go through a ByteSource / ByteSink so large videos are processed
 * chunk by chunk from disk instead of being held in memory.
 */
import { base64ToUint8, uint8ToBase64 } from "@keeplas/crypto/encoding";

// Above this size, encrypt/decrypt chunk by chunk from disk. Kept low: the
// single-shot path holds plaintext + ciphertext (and copies) on the JS heap
// at once, a multiple of the file size — too much for 2 GB phones. Readers
// dispatch on the stored IV sentinel, so changing it stays compatible.
export const STREAM_THRESHOLD_BYTES = 2 * 1024 * 1024;
export const STREAM_IV_SENTINEL = "__stream__";
const CHUNK_SIZE = 1 << 20;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/** Copy into a fresh ArrayBuffer-backed view (strict BufferSource typing). */
export function fresh(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** A fresh, extractable per-item AES-256-GCM key (re-wrapped when sharing). */
export function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]) as Promise<CryptoKey>;
}

export function importAesKey(
  raw: Uint8Array,
  extractable = false,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    fresh(raw),
    { name: "AES-GCM", length: 256 },
    extractable,
    ["encrypt", "decrypt"],
  );
}

export async function exportRawKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}

/** UTF-8 text → JSON {ciphertext, iv} under `key`. */
export async function encryptText(
  plaintext: string,
  key: CryptoKey,
): Promise<string> {
  const iv = randomBytes(IV_LENGTH);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    fresh(new TextEncoder().encode(plaintext)),
  );
  return JSON.stringify({
    ciphertext: uint8ToBase64(new Uint8Array(ciphertext)),
    iv: uint8ToBase64(iv),
  });
}

/** Inverse of {@link encryptText}; throws on a wrong key (GCM tag). */
export async function decryptText(
  encryptedJson: string,
  key: CryptoKey,
): Promise<string> {
  const { ciphertext, iv } = JSON.parse(encryptedJson) as {
    ciphertext: string;
    iv: string;
  };
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToUint8(iv) },
    key,
    base64ToUint8(ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}

/** Random-access reader over a plaintext or ciphertext file. */
export interface ByteSource {
  size: number;
  read: (offset: number, length: number) => Uint8Array;
}

/** Append-only writer. */
export interface ByteSink {
  write: (bytes: Uint8Array) => void;
}

export function memorySource(bytes: Uint8Array): ByteSource {
  return {
    size: bytes.byteLength,
    read: (offset, length) => bytes.subarray(offset, offset + length),
  };
}

export function memorySink(): ByteSink & {
  bytes: () => Uint8Array<ArrayBuffer>;
} {
  const parts: Uint8Array[] = [];
  return {
    write: (b) => parts.push(fresh(b)),
    bytes: () => {
      const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
      let offset = 0;
      for (const p of parts) {
        out.set(p, offset);
        offset += p.byteLength;
      }
      return out;
    },
  };
}

function chunkAad(index: number, count: number): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, index, false);
  view.setUint32(4, count, false);
  return new Uint8Array(buffer);
}

/**
 * Encrypt a file into `sink`. Returns the IV the server stores: base64 for
 * a single-shot blob, {@link STREAM_IV_SENTINEL} for the chunked format.
 */
export async function encryptFile(
  source: ByteSource,
  sink: ByteSink,
  key: CryptoKey,
): Promise<string> {
  if (source.size <= STREAM_THRESHOLD_BYTES) {
    const iv = randomBytes(IV_LENGTH);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      fresh(source.read(0, source.size)),
    );
    sink.write(new Uint8Array(ciphertext));
    return uint8ToBase64(iv);
  }
  const count = Math.ceil(source.size / CHUNK_SIZE);
  for (let index = 0; index < count; index++) {
    const offset = index * CHUNK_SIZE;
    const plain = source.read(
      offset,
      Math.min(CHUNK_SIZE, source.size - offset),
    );
    const iv = randomBytes(IV_LENGTH);
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        tagLength: 128,
        additionalData: chunkAad(index, count),
      },
      key,
      fresh(plain),
    );
    sink.write(iv);
    sink.write(new Uint8Array(ciphertext));
  }
  return STREAM_IV_SENTINEL;
}

/** Inverse of {@link encryptFile} (also opens web uploads). */
export async function decryptFile(
  source: ByteSource,
  iv: string,
  key: CryptoKey,
  sink: ByteSink,
): Promise<void> {
  if (iv !== STREAM_IV_SENTINEL) {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToUint8(iv) },
      key,
      fresh(source.read(0, source.size)),
    );
    sink.write(new Uint8Array(plaintext));
    return;
  }
  const frameSize = IV_LENGTH + CHUNK_SIZE + TAG_LENGTH;
  const count = source.size === 0 ? 0 : Math.ceil(source.size / frameSize);
  for (let index = 0; index < count; index++) {
    const offset = index * frameSize;
    const frame = source.read(
      offset,
      Math.min(frameSize, source.size - offset),
    );
    if (frame.byteLength < IV_LENGTH + TAG_LENGTH) {
      throw new Error("Corrupted stream: frame smaller than IV + tag");
    }
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: fresh(frame.subarray(0, IV_LENGTH)),
        tagLength: 128,
        additionalData: chunkAad(index, count),
      },
      key,
      fresh(frame.subarray(IV_LENGTH)),
    );
    sink.write(new Uint8Array(plaintext));
  }
}
