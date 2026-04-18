const DEFAULT_CHUNK_SIZE = 1 << 20; // 1 MB
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a Blob in fixed-size chunks using AES-256-GCM.
 * Each chunk is stored as `[12-byte IV][ciphertext + 16-byte auth tag]`,
 * concatenated in order. The caller is expected to pass the same
 * chunkSize at decryption.
 */
export async function encryptStream(
  blob: Blob,
  key: CryptoKey,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): Promise<{ cipherBlob: Blob; chunkCount: number }> {
  if (chunkSize <= 0) throw new Error("chunkSize must be > 0");

  const parts: BlobPart[] = [];
  const total = blob.size;
  let offset = 0;
  let chunkCount = 0;

  while (offset < total || (total === 0 && chunkCount === 0)) {
    const end = Math.min(offset + chunkSize, total);
    const slice = blob.slice(offset, end);
    const plaintext = await slice.arrayBuffer();

    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      plaintext
    );

    parts.push(iv, ciphertext);
    offset = end;
    chunkCount += 1;
    if (total === 0) break;
  }

  return { cipherBlob: new Blob(parts), chunkCount };
}

/**
 * Decrypt a Blob produced by {@link encryptStream} back to its plaintext form.
 */
export async function decryptStream(
  cipherBlob: Blob,
  key: CryptoKey,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): Promise<Blob> {
  if (chunkSize <= 0) throw new Error("chunkSize must be > 0");

  const encryptedChunkSize = chunkSize + AUTH_TAG_LENGTH;
  const frameSize = IV_LENGTH + encryptedChunkSize;

  const parts: BlobPart[] = [];
  const total = cipherBlob.size;
  let offset = 0;

  while (offset < total) {
    const frameEnd = Math.min(offset + frameSize, total);
    const frame = await cipherBlob.slice(offset, frameEnd).arrayBuffer();
    if (frame.byteLength < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error("Corrupted stream: frame smaller than IV + auth tag");
    }
    const iv = new Uint8Array(frame, 0, IV_LENGTH);
    const body = new Uint8Array(frame, IV_LENGTH);

    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      body
    );
    parts.push(plaintext);
    offset = frameEnd;
  }

  return new Blob(parts);
}

export const STREAM_CHUNK_SIZE = DEFAULT_CHUNK_SIZE;
