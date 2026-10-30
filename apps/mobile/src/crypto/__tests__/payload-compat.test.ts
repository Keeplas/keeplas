/**
 * @jest-environment node
 */
import { decryptStream, encryptStream } from "@keeplas/crypto/aes";
import { base64ToUint8, uint8ToBase64 } from "@keeplas/crypto/encoding";
import {
  generateRecipientKeyPair,
  serializePublicKey,
  serializeSecretKey,
  unwrapDek,
  wrapDek,
} from "@keeplas/crypto/kem";
import {
  deriveContactTrust,
  generateIdentityKeyPair,
  identityKeyFingerprint,
  signKemBinding,
  type PinWrite,
} from "@keeplas/crypto/sig";

import { ContactKeyBlocked, requireVerifiedKey } from "../contact-keys";
import {
  decryptFile,
  decryptText,
  encryptFile,
  encryptText,
  generateDek,
  memorySink,
  memorySource,
  STREAM_IV_SENTINEL,
  STREAM_THRESHOLD_BYTES,
} from "../envelope";
import {
  fileMetaJson,
  itemMetaJson,
  parseFileMeta,
  parseItemMeta,
} from "../item-meta";
import {
  loadOwnerKeys,
  sealRetiredSecretKeys,
  unwrapOwnerDek,
} from "../owner-keys";

jest.setTimeout(60_000);

/** Byte equality without Jest's per-element diff (megabyte buffers). */
const same = (a: Uint8Array, b: Uint8Array) =>
  Buffer.from(a).equals(Buffer.from(b));

/** Exactly what apps/web/src/lib/use-vault-crypto.ts encryptContentWithKey writes. */
async function webEncryptContent(plaintext: string, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return JSON.stringify({
    ciphertext: uint8ToBase64(new Uint8Array(ct)),
    iv: uint8ToBase64(iv),
  });
}

describe("text envelope ({ciphertext, iv})", () => {
  it("opens web ciphertext and the web opens ours", async () => {
    const dek = await generateDek();
    const fromWeb = await webEncryptContent("Will and estate plan", dek);
    expect(await decryptText(fromWeb, dek)).toBe("Will and estate plan");

    const ours = JSON.parse(await encryptText("Passeport é", dek)) as {
      ciphertext: string;
      iv: string;
    };
    expect(Object.keys(ours).sort()).toEqual(["ciphertext", "iv"]);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToUint8(ours.iv) },
      dek,
      base64ToUint8(ours.ciphertext),
    );
    expect(new TextDecoder().decode(plain)).toBe("Passeport é");
  });
});

describe("metadata payloads (F4)", () => {
  it("matches the web JSON shapes", () => {
    expect(itemMetaJson({ category: "inbox" })).toBe(
      '{"v":1,"category":"inbox"}',
    );
    expect(itemMetaJson({ category: "other", categoryId: "k1" }, "pin")).toBe(
      '{"v":1,"category":"other","icon":"pin","categoryId":"k1"}',
    );
    expect(
      fileMetaJson({
        name: "scan.jpg",
        mimeType: "image/jpeg",
        size: 1200,
        kind: "image",
      }),
    ).toBe(
      '{"name":"scan.jpg","mimeType":"image/jpeg","size":1200,"kind":"image","v":1}',
    );
    expect(parseItemMeta('{"v":1,"category":"credential"}').category).toBe(
      "credential",
    );
    expect(
      parseFileMeta(
        '{"v":1,"name":"memo.m4a","mimeType":"audio/mp4","size":9,"kind":"audio","durationSec":12}',
      ).durationSec,
    ).toBe(12);
  });
});

describe("file encryption", () => {
  it("single-shot blobs use a base64 IV", async () => {
    const dek = await generateDek();
    const plain = crypto.getRandomValues(new Uint8Array(4096));
    const sink = memorySink();
    const iv = await encryptFile(memorySource(plain), sink, dek);
    expect(iv).not.toBe(STREAM_IV_SENTINEL);
    const ct = sink.bytes();
    // Web side: decryptBlobWithKey single-shot path.
    const webPlain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToUint8(iv) },
      dek,
      ct,
    );
    expect(new Uint8Array(webPlain)).toEqual(plain);
  });

  it("large files use the @keeplas/crypto stream format both ways", async () => {
    const dek = await generateDek();
    const size = STREAM_THRESHOLD_BYTES + 300_000;
    const plain = new Uint8Array(size).map((_, i) => i % 251);

    const sink = memorySink();
    expect(await encryptFile(memorySource(plain), sink, dek)).toBe(
      STREAM_IV_SENTINEL,
    );
    const byWeb = await decryptStream(new Blob([sink.bytes()]), dek);
    expect(same(new Uint8Array(await byWeb.arrayBuffer()), plain)).toBe(true);

    const { cipherBlob } = await encryptStream(new Blob([plain]), dek);
    const out = memorySink();
    await decryptFile(
      memorySource(new Uint8Array(await cipherBlob.arrayBuffer())),
      STREAM_IV_SENTINEL,
      dek,
      out,
    );
    expect(same(out.bytes(), plain)).toBe(true);
  });
});

describe("owner keys and contact verification", () => {
  it("opens DEKs wrapped to the current or the pre-rotation key", async () => {
    const master = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const current = generateRecipientKeyPair();
    const previous = generateRecipientKeyPair();
    const user = {
      _id: "u1",
      publicKey: serializePublicKey(current.publicKey),
      encryptedAsymmetricSecretKey: await encryptText(
        serializeSecretKey(current.secretKey),
        master,
      ),
      encryptedAsymmetricSecretKeyPrev: await encryptText(
        serializeSecretKey(previous.secretKey),
        master,
      ),
    };
    const keys = await loadOwnerKeys(user, master);
    const dek = await generateDek();
    const old = await wrapDek(dek, serializePublicKey(previous.publicKey));
    const opened = await unwrapOwnerDek(old, keys);
    const fresh = await wrapDek(opened, keys.publicKey);
    await expect(unwrapDek(fresh, current.secretKey)).resolves.toBeDefined();
  });

  it("still opens what others sealed to a key retired by a finished rotation", async () => {
    // An owner who shared an item with me (or a recovery share) sealed it to
    // my key of the time; my rotation must not cut me off from it.
    const master = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const current = generateRecipientKeyPair();
    const retired = [generateRecipientKeyPair(), generateRecipientKeyPair()];
    const keys = await loadOwnerKeys(
      {
        _id: "u-retired",
        publicKey: serializePublicKey(current.publicKey),
        encryptedAsymmetricSecretKey: await encryptText(
          serializeSecretKey(current.secretKey),
          master,
        ),
        encryptedRetiredSecretKeys: await sealRetiredSecretKeys(
          retired.map((pair) => pair.secretKey),
          master,
        ),
      },
      master,
    );
    for (const pair of retired) {
      const wrapped = await wrapDek(
        await generateDek(),
        serializePublicKey(pair.publicKey),
      );
      await expect(unwrapOwnerDek(wrapped, keys)).resolves.toBeDefined();
    }
  });

  it("refuses a server-published owner key that is not the secret key's own", async () => {
    const master = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const own = generateRecipientKeyPair();
    const user = {
      _id: "u2",
      publicKey: serializePublicKey(generateRecipientKeyPair().publicKey),
      encryptedAsymmetricSecretKey: await encryptText(
        serializeSecretKey(own.secretKey),
        master,
      ),
    };
    await expect(loadOwnerKeys(user, master)).rejects.toThrow(/does not match/);
  });

  it("verifies the key binding and the authenticated TOFU pin", async () => {
    const master = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const trust = await deriveContactTrust("owner", master);
    const kem = generateRecipientKeyPair();
    const identity = generateIdentityKeyPair();
    const contactPublicKey = serializePublicKey(kem.publicKey);
    const material = {
      contactId: "c1",
      contactUserId: "contact-user",
      contactPublicKey,
      contactIdentityPublicKey: identity.publicKey,
      contactPublicKeySignature: await signKemBinding(
        identity.secretKey,
        "contact-user",
        contactPublicKey,
      ),
      hasWraps: false,
    };
    const pins: PinWrite[] = [];
    const pin = async (_: string, write: PinWrite) => pins.push(write);

    // First use: the key is returned and a MACed pin persisted.
    expect(await requireVerifiedKey(material, trust, pin)).toBe(
      contactPublicKey,
    );
    expect(pins).toEqual([
      {
        fingerprint: await identityKeyFingerprint(identity.publicKey),
        mac: expect.any(String),
      },
    ]);
    const pinned = {
      ...material,
      pinnedIdentityFingerprint: pins[0].fingerprint,
      pinnedIdentityMac: pins[0].mac,
      hasWraps: true,
    };
    expect(await requireVerifiedKey(pinned, trust, pin)).toBe(contactPublicKey);
    expect(pins).toHaveLength(1);

    // A server that strips the pin of a contact already sealed to is refused.
    await expect(
      requireVerifiedKey(
        {
          ...pinned,
          pinnedIdentityMac: undefined,
          pinnedIdentityFingerprint: undefined,
        },
        trust,
        pin,
      ),
    ).rejects.toMatchObject({ reason: "pin_unverified" });
    const swapped = serializePublicKey(generateRecipientKeyPair().publicKey);
    await expect(
      requireVerifiedKey({ ...pinned, contactPublicKey: swapped }, trust, pin),
    ).rejects.toBeInstanceOf(ContactKeyBlocked);
    expect(pins).toHaveLength(1);
  });
});
