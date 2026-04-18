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

    const decrypted = await decryptStream(cipherBlob, key);
    expect(await blobToUint8(decrypted)).toEqual(data);
  });

  it("round-trips across multiple chunks (non-aligned remainder)", async () => {
    const key = await generateMasterKey();
    const chunkSize = 64 * 1024;
    const data = randomBytes(chunkSize * 3 + 1234);
    const blob = new Blob([data]);

    const { cipherBlob, chunkCount } = await encryptStream(blob, key, chunkSize);
    expect(chunkCount).toBe(4);

    const decrypted = await decryptStream(cipherBlob, key, chunkSize);
    expect(await blobToUint8(decrypted)).toEqual(data);
  });

  it("round-trips on exact chunk boundary", async () => {
    const key = await generateMasterKey();
    const chunkSize = 32 * 1024;
    const data = randomBytes(chunkSize * 2);
    const blob = new Blob([data]);

    const { cipherBlob, chunkCount } = await encryptStream(blob, key, chunkSize);
    expect(chunkCount).toBe(2);

    const decrypted = await decryptStream(cipherBlob, key, chunkSize);
    expect(await blobToUint8(decrypted)).toEqual(data);
  });

  it("handles an empty blob", async () => {
    const key = await generateMasterKey();
    const blob = new Blob([]);

    const { cipherBlob, chunkCount } = await encryptStream(blob, key);
    expect(chunkCount).toBe(1);

    const decrypted = await decryptStream(cipherBlob, key);
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
      await blobToUint8(b.cipherBlob)
    );
  });
});
