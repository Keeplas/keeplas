const DEFAULT_CHUNK_SIZE = 1 << 20; // 1 MB
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const AAD_LENGTH = 8; // [u32 chunkIndex][u32 chunkCount], big-endian

/**
 * Build the per-chunk AAD that binds a chunk to its position and to the
 * total chunk count: [u32 chunkIndex][u32 chunkCount] (big-endian).
 *
 * Because GCM authenticates this AAD, an attacker cannot reorder chunks
 * (index changes), drop trailing chunks, or splice chunks from a blob with a
 * different length (count changes) without the tag failing on decrypt.
 */
function chunkAad(
  chunkIndex: number,
  chunkCount: number,
): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(AAD_LENGTH);
  const view = new DataView(buffer);
  view.setUint32(0, chunkIndex, false);
  view.setUint32(4, chunkCount, false);
  return new Uint8Array(buffer);
}

/**
 * Encrypt a Blob in fixed-size chunks using AES-256-GCM.
 * Each chunk is stored as `[12-byte IV][ciphertext + 16-byte auth tag]`,
 * concatenated in order. The chunk index and total chunk count are bound as
 * AAD (not stored) so truncation/reordering is detected on decrypt.
 *
 * The caller must pass the same `chunkSize` AND the returned `chunkCount`
 * to {@link decryptStream}.
 */
export async function encryptStream(
  blob: Blob,
  key: CryptoKey,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): Promise<{ cipherBlob: Blob; chunkCount: number }> {
  if (chunkSize <= 0) throw new Error("chunkSize must be > 0");

  const total = blob.size;
  // Number of plaintext chunks. Empty blobs still produce exactly one
  // (empty) chunk so the format round-trips and the count is well-defined.
  const chunkCount = total === 0 ? 1 : Math.ceil(total / chunkSize);

  const parts: BlobPart[] = [];
  let offset = 0;
  let chunkIndex = 0;

  while (offset < total || (total === 0 && chunkIndex === 0)) {
    const end = Math.min(offset + chunkSize, total);
    const slice = blob.slice(offset, end);
    const plaintext = await slice.arrayBuffer();

    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        tagLength: 128,
        additionalData: chunkAad(chunkIndex, chunkCount),
      },
      key,
      plaintext,
    );

    parts.push(iv, ciphertext);
    offset = end;
    chunkIndex += 1;
    if (total === 0) break;
  }

  return { cipherBlob: new Blob(parts), chunkCount };
}

/**
 * Decrypt a Blob produced by {@link encryptStream} back to its plaintext form.
 *
 * `chunkCount` (returned by {@link encryptStream}) must be supplied so the
 * AAD can be reconstructed and the stream length verified. If it is omitted
 * the count is inferred from the blob size — this still detects reordering
 * and mid-stream truncation per chunk, but cannot detect that whole trailing
 * chunks were removed, so pass it whenever it is known.
 */
export async function decryptStream(
  cipherBlob: Blob,
  key: CryptoKey,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  chunkCount?: number,
): Promise<Blob> {
  if (chunkSize <= 0) throw new Error("chunkSize must be > 0");

  const encryptedChunkSize = chunkSize + AUTH_TAG_LENGTH;
  const frameSize = IV_LENGTH + encryptedChunkSize;

  const total = cipherBlob.size;
  // Frames are fixed-size except possibly the last; infer the frame count.
  const inferredCount = total === 0 ? 0 : Math.ceil(total / frameSize);
  const expectedCount = chunkCount ?? inferredCount;

  const parts: BlobPart[] = [];
  let offset = 0;
  let chunkIndex = 0;

  while (offset < total) {
    const frameEnd = Math.min(offset + frameSize, total);
    const frame = await cipherBlob.slice(offset, frameEnd).arrayBuffer();
    if (frame.byteLength < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error("Corrupted stream: frame smaller than IV + auth tag");
    }
    const iv = new Uint8Array(frame, 0, IV_LENGTH);
    const body = new Uint8Array(frame, IV_LENGTH);

    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        tagLength: 128,
        additionalData: chunkAad(chunkIndex, expectedCount),
      },
      key,
      body,
    );
    parts.push(plaintext);
    offset = frameEnd;
    chunkIndex += 1;
  }

  // The blob must be fully consumed and the number of chunks we actually
  // authenticated must equal the count bound into every chunk's AAD.
  // (If trailing chunks were dropped, chunkIndex < expectedCount AND the
  //  AAD count we used would not match what the encryptor bound, so the
  //  per-chunk tags would already have failed — this is the explicit check.)
  if (offset !== total) {
    throw new Error("Corrupted stream: trailing bytes after last frame");
  }
  if (chunkIndex !== expectedCount) {
    throw new Error(
      `Corrupted stream: expected ${expectedCount} chunks, decrypted ${chunkIndex}`,
    );
  }

  return new Blob(parts);
}

export const STREAM_CHUNK_SIZE = DEFAULT_CHUNK_SIZE;
