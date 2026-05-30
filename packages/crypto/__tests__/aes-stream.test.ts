import { describe, it, expect } from "vitest";
import { generateMasterKey, encryptStream, decryptStream } from "../src/aes";

function randomBytes(size: number): Uint8Array {
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i += 65536) {
    crypto.getRandomValues(out.subarray(i, Math.min(i + 65536, size)));
  }
  return out;
}

async function blobToUint8(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

describe("AES-GCM streaming", () => {
  it("round-trips a blob smaller than one chunk", async () => {
    const key = await generateMasterKey();
    const data = randomBytes(2048);
    const blob = new Blob([data]);

    const { cipherBlob, chunkCount } = await encryptStream(blob, key);
    expect(chunkCount).toBe(1);

    const decrypted = await decryptStream(
      cipherBlob,
      key,
      undefined,
      chunkCount,
    );
    expect(await blobToUint8(decrypted)).toEqual(data);
  });

  it("round-trips across multiple chunks (non-aligned remainder)", async () => {
    const key = await generateMasterKey();
    const chunkSize = 64 * 1024;
    const data = randomBytes(chunkSize * 3 + 1234);
    const blob = new Blob([data]);

    const { cipherBlob, chunkCount } = await encryptStream(
      blob,
      key,
      chunkSize,
    );
    expect(chunkCount).toBe(4);

    const decrypted = await decryptStream(
      cipherBlob,
      key,
      chunkSize,
      chunkCount,
    );
    expect(await blobToUint8(decrypted)).toEqual(data);
  });

  it("round-trips on exact chunk boundary", async () => {
    const key = await generateMasterKey();
    const chunkSize = 32 * 1024;
    const data = randomBytes(chunkSize * 2);
    const blob = new Blob([data]);

    const { cipherBlob, chunkCount } = await encryptStream(
      blob,
      key,
      chunkSize,
    );
    expect(chunkCount).toBe(2);

    const decrypted = await decryptStream(
      cipherBlob,
      key,
      chunkSize,
      chunkCount,
    );
    expect(await blobToUint8(decrypted)).toEqual(data);
  });

  it("handles an empty blob", async () => {
    const key = await generateMasterKey();
    const blob = new Blob([]);

    const { cipherBlob, chunkCount } = await encryptStream(blob, key);
    expect(chunkCount).toBe(1);

    const decrypted = await decryptStream(
      cipherBlob,
      key,
      undefined,
      chunkCount,
    );
    expect(decrypted.size).toBe(0);
  });

  it("fails to decrypt with the wrong key", async () => {
    const key1 = await generateMasterKey();
    const key2 = await generateMasterKey();
    const data = randomBytes(4096);
    const { cipherBlob } = await encryptStream(new Blob([data]), key1);

    await expect(decryptStream(cipherBlob, key2)).rejects.toThrow();
  });

  it("produces different ciphertext for identical plaintext (random IVs)", async () => {
    const key = await generateMasterKey();
    const data = randomBytes(8192);
    const blob = new Blob([data]);

    const a = await encryptStream(blob, key);
    const b = await encryptStream(blob, key);

    expect(await blobToUint8(a.cipherBlob)).not.toEqual(
      await blobToUint8(b.cipherBlob),
    );
  });

  it("rejects a truncated stream (a trailing chunk removed)", async () => {
    const key = await generateMasterKey();
    const chunkSize = 16 * 1024;
    const data = randomBytes(chunkSize * 3);
    const { cipherBlob, chunkCount } = await encryptStream(
      new Blob([data]),
      key,
      chunkSize,
    );
    expect(chunkCount).toBe(3);

    const frameSize = 12 + chunkSize + 16;
    // Drop the last frame entirely.
    const truncated = cipherBlob.slice(0, frameSize * 2);

    await expect(
      decryptStream(truncated, key, chunkSize, chunkCount),
    ).rejects.toThrow();
  });

  it("rejects reordered chunks (AAD chunk index mismatch)", async () => {
    const key = await generateMasterKey();
    const chunkSize = 16 * 1024;
    const data = randomBytes(chunkSize * 2);
    const { cipherBlob, chunkCount } = await encryptStream(
      new Blob([data]),
      key,
      chunkSize,
    );
    expect(chunkCount).toBe(2);

    const frameSize = 12 + chunkSize + 16;
    const bytes = await blobToUint8(cipherBlob);
    const frame0 = bytes.slice(0, frameSize);
    const frame1 = bytes.slice(frameSize, frameSize * 2);
    // Swap the two frames — indices no longer match the bound AAD.
    const swapped = new Blob([frame1, frame0]);

    await expect(
      decryptStream(swapped, key, chunkSize, chunkCount),
    ).rejects.toThrow();
  });

  it("rejects a chunkCount mismatch from the caller", async () => {
    const key = await generateMasterKey();
    const chunkSize = 16 * 1024;
    const data = randomBytes(chunkSize * 2);
    const { cipherBlob } = await encryptStream(
      new Blob([data]),
      key,
      chunkSize,
    );

    // Claim a different count than what was bound at encryption time.
    await expect(
      decryptStream(cipherBlob, key, chunkSize, 5),
    ).rejects.toThrow();
  });
});
