import { describe, it, expect } from "vitest";
import { generateMasterKey, encrypt, decrypt } from "../src/aes";

describe("AES-256-GCM", () => {
  it("generates a 256-bit extractable key", async () => {
    const key = await generateMasterKey();
    expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
    expect(key.extractable).toBe(true);
    expect(key.usages).toContain("encrypt");
    expect(key.usages).toContain("decrypt");
  });

  it("generates different keys each time", async () => {
    const key1 = await generateMasterKey();
    const key2 = await generateMasterKey();
    const raw1 = await crypto.subtle.exportKey("raw", key1);
    const raw2 = await crypto.subtle.exportKey("raw", key2);
    expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
  });

  it("encrypts and decrypts text roundtrip", async () => {
    const key = await generateMasterKey();
    const plaintext = new TextEncoder().encode("Hello, Keeplas vault!");
    const { ciphertext, iv } = await encrypt(plaintext, key);

    expect(ciphertext.byteLength).toBeGreaterThan(0);
    expect(iv.length).toBe(12);

    const decrypted = await decrypt(ciphertext, key, iv);
    const result = new TextDecoder().decode(decrypted);
    expect(result).toBe("Hello, Keeplas vault!");
  });

  it("encrypts and decrypts JSON roundtrip", async () => {
    const key = await generateMasterKey();
    const data = {
      name: "Test Vault Item",
      secret: "password123",
      amount: 42000,
    };
    const plaintext = new TextEncoder().encode(JSON.stringify(data));

    const { ciphertext, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, key, iv);
    const result = JSON.parse(new TextDecoder().decode(decrypted));

    expect(result).toEqual(data);
  });

  it("encrypts and decrypts binary data roundtrip", async () => {
    const key = await generateMasterKey();
    const plaintext = new Uint8Array(256);
    crypto.getRandomValues(plaintext);

    const { ciphertext, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, key, iv);

    expect(new Uint8Array(decrypted)).toEqual(plaintext);
  });

  it("generates unique IV per encryption", async () => {
    const key = await generateMasterKey();
    const plaintext = new TextEncoder().encode("same data");

    const result1 = await encrypt(plaintext, key);
    const result2 = await encrypt(plaintext, key);

    expect(result1.iv).not.toEqual(result2.iv);
  });

  it("produces different ciphertext for same plaintext (due to random IV)", async () => {
    const key = await generateMasterKey();
    const plaintext = new TextEncoder().encode("same data");

    const result1 = await encrypt(plaintext, key);
    const result2 = await encrypt(plaintext, key);

    expect(new Uint8Array(result1.ciphertext)).not.toEqual(
      new Uint8Array(result2.ciphertext),
    );
  });

  it("fails to decrypt with wrong key", async () => {
    const key1 = await generateMasterKey();
    const key2 = await generateMasterKey();
    const plaintext = new TextEncoder().encode("secret");

    const { ciphertext, iv } = await encrypt(plaintext, key1);

    await expect(decrypt(ciphertext, key2, iv)).rejects.toThrow();
  });

  it("fails to decrypt with wrong IV", async () => {
    const key = await generateMasterKey();
    const plaintext = new TextEncoder().encode("secret");

    const { ciphertext } = await encrypt(plaintext, key);
    const wrongIv = crypto.getRandomValues(new Uint8Array(12));

    await expect(decrypt(ciphertext, key, wrongIv)).rejects.toThrow();
  });

  it("handles empty plaintext", async () => {
    const key = await generateMasterKey();
    const plaintext = new Uint8Array(0);

    const { ciphertext, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, key, iv);

    expect(new Uint8Array(decrypted)).toEqual(plaintext);
  });

  it("round-trips with additionalData (AAD)", async () => {
    const key = await generateMasterKey();
    const plaintext = new TextEncoder().encode("bound to header");
    const aad = new TextEncoder().encode("item:123|v:1");

    const { ciphertext, iv } = await encrypt(plaintext, key, aad);
    const decrypted = await decrypt(ciphertext, key, iv, aad);

    expect(new TextDecoder().decode(decrypted)).toBe("bound to header");
  });

  it("fails to decrypt when AAD does not match", async () => {
    const key = await generateMasterKey();
    const plaintext = new TextEncoder().encode("bound to header");
    const aad = new TextEncoder().encode("item:123|v:1");

    const { ciphertext, iv } = await encrypt(plaintext, key, aad);
    const wrongAad = new TextEncoder().encode("item:999|v:1");

    await expect(decrypt(ciphertext, key, iv, wrongAad)).rejects.toThrow();
  });

  it("fails to decrypt when AAD is omitted but was present at encryption", async () => {
    const key = await generateMasterKey();
    const plaintext = new TextEncoder().encode("bound to header");
    const aad = new TextEncoder().encode("item:123|v:1");

    const { ciphertext, iv } = await encrypt(plaintext, key, aad);

    await expect(decrypt(ciphertext, key, iv)).rejects.toThrow();
  });

  it("handles large data", async () => {
    const key = await generateMasterKey();
    const plaintext = new Uint8Array(1024 * 100); // 100KB
    // getRandomValues limited to 65536 bytes, fill in chunks
    for (let i = 0; i < plaintext.length; i += 65536) {
      const chunk = plaintext.subarray(
        i,
        Math.min(i + 65536, plaintext.length),
      );
      crypto.getRandomValues(chunk);
    }

    const { ciphertext, iv } = await encrypt(plaintext, key);
    const decrypted = await decrypt(ciphertext, key, iv);

    expect(new Uint8Array(decrypted)).toEqual(plaintext);
  });
});
