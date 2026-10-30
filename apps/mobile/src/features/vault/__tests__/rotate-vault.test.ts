/**
 * @jest-environment node
 */
import {
  generateRecipientKeyPair,
  parseSecretKey,
  serializePublicKey,
  serializeSecretKey,
  unwrapDek,
  wrapDek,
} from "@keeplas/crypto/kem";
import {
  deriveContactTrust,
  generateIdentityKeyPair,
  signKemBinding,
  verifyContactKey,
} from "@keeplas/crypto/sig";

import { ContactKeyBlocked } from "@/crypto/contact-keys";
import {
  decryptText,
  encryptText,
  exportRawKey,
  generateDek,
  importAesKey,
} from "@/crypto/envelope";
import { sealRetiredSecretKeys } from "@/crypto/owner-keys";
import { openKeyBundleWithRootKey } from "@/crypto/vault-keys";
import { rotateVault, type RotationDeps } from "../rotate-vault";

// Argon2id (kit material) is covered in packages/crypto; a SHA-256 stand-in
// keeps "same words + salt → same RootKey" without Jest timeouts.
jest.mock("@keeplas/crypto/kdf", () => {
  const derive = async (phrase: string | string[], salt: Uint8Array) =>
    crypto.subtle.importKey(
      "raw",
      await crypto.subtle.digest(
        "SHA-256",
        new Uint8Array([
          ...new TextEncoder().encode([phrase].flat().join(" ")),
          ...salt,
        ]),
      ),
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
  return { deriveRootKey: derive, deriveDeviceWrapKey: derive };
});
jest.mock("@keeplas/crypto/recovery", () => ({
  ...jest.requireActual("@keeplas/crypto/recovery"),
  derivePhraseVerifier: async () => "verifier",
}));

const OWNER = "owner-1";

const newMasterKey = () =>
  crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);

/** A verified contact the owner already pinned (and sealed to). */
async function pinnedContact(masterKey: CryptoKey, id: string) {
  const kem = generateRecipientKeyPair();
  const identity = generateIdentityKeyPair();
  const contactPublicKey = serializePublicKey(kem.publicKey);
  const material = {
    contactId: id,
    contactUserId: `${id}-user`,
    contactPublicKey,
    contactIdentityPublicKey: identity.publicKey,
    contactPublicKeySignature: await signKemBinding(
      identity.secretKey,
      `${id}-user`,
      contactPublicKey,
    ),
  };
  const first = await verifyContactKey(
    { ...material, hasWraps: false },
    await deriveContactTrust(OWNER, masterKey),
  );
  if (first.status !== "ok" || !first.pin) throw new Error("setup");
  return {
    secretKey: kem.secretKey,
    row: {
      ...material,
      pinnedIdentityFingerprint: first.pin.fingerprint,
      pinnedIdentityMac: first.pin.mac,
      hasWraps: true as const,
    },
  };
}

type Row = { _id: string; ownerWrappedDek?: string };

/** An account before rotation, and a fake server holding its rows. */
async function setup() {
  const masterKey = await newMasterKey();
  const owner = generateRecipientKeyPair();
  const older = generateRecipientKeyPair(); // retired by an earlier rotation
  const ownerPk = serializePublicKey(owner.publicKey);
  const contact = await pinnedContact(masterKey, "c1");

  const dekA = await generateDek();
  const dekB = await generateDek();
  const items: Row[] = [
    { _id: "a", ownerWrappedDek: await wrapDek(dekA, ownerPk) },
    // Sealed to the key an earlier rotation retired, never re-wrapped.
    {
      _id: "b",
      ownerWrappedDek: await wrapDek(dekB, serializePublicKey(older.publicKey)),
    },
  ];
  const recipients = new Map<string, string>([
    ["a", await wrapDek(dekA, contact.row.contactPublicKey)],
  ]);
  const categories = [
    { _id: "cat1", encryptedName: await encryptText("Taxes", masterKey) },
  ];

  const user = {
    _id: OWNER,
    phraseSalt: "salt",
    publicKey: ownerPk,
    encryptedAsymmetricSecretKey: await encryptText(
      serializeSecretKey(owner.secretKey),
      masterKey,
    ),
    encryptedRetiredSecretKeys: await sealRetiredSecretKeys(
      [older.secretKey],
      masterKey,
    ),
  };

  const calls = {
    rotate: [] as Parameters<RotationDeps["server"]["rotate"]>[0][],
    finalize: [] as Parameters<RotationDeps["server"]["finalize"]>[0][],
    updates: [] as string[],
    kept: [] as { masterKey: Uint8Array; rootKey: Uint8Array | null }[],
  };
  let extraOnSecondRead: Row | null = null;
  let reads = 0;

  const deps: RotationDeps = {
    user,
    masterKey,
    rootKey: new Uint8Array(32).fill(9),
    server: {
      items: async () => {
        reads += 1;
        if (reads === 3 && extraOnSecondRead) items.push(extraOnSecondRead);
        return items.map((item) => ({ ...item })) as never;
      },
      recipients: async (itemId) =>
        (recipients.has(itemId) ? [{ ...contact.row }] : []) as never,
      contacts: async () =>
        [{ ...contact.row, _id: contact.row.contactId }] as never,
      categories: async () => categories as never,
      folders: async () => [],
      rotate: async (args) => {
        calls.rotate.push(args);
        for (const name of args.categoryNames) {
          categories.find((c) => c._id === name.id)!.encryptedName =
            name.encryptedName;
        }
        for (const pin of args.contactPins) {
          contact.row.pinnedIdentityMac = pin.mac;
        }
      },
      updateItem: async (args) => {
        calls.updates.push(args.itemId);
        items.find((i) => i._id === args.itemId)!.ownerWrappedDek =
          args.ownerWrappedDek;
        for (const key of args.recipientKeys ?? []) {
          recipients.set(args.itemId, key.wrappedDek);
        }
      },
      finalize: async (args) => {
        calls.finalize.push(args);
      },
      pin: async () => undefined,
    },
    keepKeys: async (keys) => {
      calls.kept.push({
        masterKey: keys.masterKey.slice(),
        rootKey: keys.rootKey,
      });
      keys.masterKey.fill(0);
    },
  };
  return {
    deps,
    masterKey,
    owner,
    older,
    contact,
    items,
    recipients,
    categories,
    calls,
    deks: { a: dekA, b: dekB },
    lateWriter: (row: Row) => (extraOnSecondRead = row),
  };
}

/** The owner secret key the committed account holds under `masterKey`. */
async function committedSecret(
  rotate: Parameters<RotationDeps["server"]["rotate"]>[0],
  masterKey: CryptoKey,
) {
  return parseSecretKey(
    await decryptText(rotate.encryptedAsymmetricSecretKey, masterKey),
  );
}

describe("rotateVault", () => {
  it("re-keys every wrap, name and pin, then retires the old RootKey", async () => {
    const s = await setup();
    const rootKey = await rotateVault(s.deps);

    expect(s.calls.rotate).toHaveLength(1);
    const [rotate] = s.calls.rotate;
    const newMaster = await importAesKey(s.calls.kept[0].masterKey, true);
    // Kept on the phone right after the commit, under the CURRENT RootKey.
    expect(s.calls.kept[0].rootKey).toEqual(new Uint8Array(32).fill(9));
    expect(
      await openKeyBundleWithRootKey(
        rotate.encryptedKeyBundle,
        new Uint8Array(32).fill(9),
      ),
    ).toEqual(s.calls.kept[0].masterKey);
    expect(s.calls.kept[0].masterKey).not.toEqual(
      await exportRawKey(s.masterKey),
    );

    // Category names follow the new MasterKey.
    expect(await decryptText(s.categories[0].encryptedName, newMaster)).toBe(
      "Taxes",
    );
    // The contact pin is re-MACed under the new MasterKey.
    const outcome = await verifyContactKey(
      {
        ...s.contact.row,
        pinnedIdentityMac: rotate.contactPins[0].mac,
      },
      await deriveContactTrust(OWNER, newMaster),
    );
    expect(outcome.status).toBe("ok");

    // Every item, including one on a key retired earlier, opens with the
    // new owner key; the recipient's wrap still opens for them.
    const newSecret = await committedSecret(rotate, newMaster);
    for (const item of s.items) {
      await expect(
        unwrapDek(item.ownerWrappedDek!, newSecret),
      ).resolves.toBeDefined();
    }
    await expect(
      unwrapDek(s.recipients.get("a")!, s.contact.secretKey),
    ).resolves.toBeDefined();

    // Finalize: archive keeps both retired keys; new kit under a new RootKey
    // that this phone kept BEFORE the server dropped `…Prev`.
    const [finalize] = s.calls.finalize;
    const archived = JSON.parse(
      await decryptText(finalize.encryptedRetiredSecretKeys, newMaster),
    ) as string[];
    expect(archived.sort()).toEqual(
      [
        serializeSecretKey(s.owner.secretKey),
        serializeSecretKey(s.older.secretKey),
      ].sort(),
    );
    expect(s.calls.kept[1].rootKey).toBe(rootKey);
    expect(
      await openKeyBundleWithRootKey(finalize.encryptedKeyBundle, rootKey),
    ).toEqual(s.calls.kept[0].masterKey);
  });

  it("changes nothing when a recipient no longer verifies", async () => {
    const s = await setup();
    // The contact's identity changed (reinstall, or a server swapping keys).
    s.contact.row.contactIdentityPublicKey =
      generateIdentityKeyPair().publicKey;
    await expect(rotateVault(s.deps)).rejects.toBeInstanceOf(ContactKeyBlocked);
    expect(s.calls.rotate).toHaveLength(0);
    expect(s.calls.updates).toHaveLength(0);
    expect(s.calls.kept).toHaveLength(0);
  });

  it("re-wraps an item written by a late device before finalizing", async () => {
    const s = await setup();
    const dek = await generateDek();
    s.lateWriter({
      _id: "late",
      ownerWrappedDek: await wrapDek(
        dek,
        serializePublicKey(s.owner.publicKey),
      ),
    });
    await rotateVault(s.deps);
    expect(s.calls.updates).toContain("late");
    const newMaster = await importAesKey(s.calls.kept[0].masterKey, true);
    const newSecret = await committedSecret(s.calls.rotate[0], newMaster);
    const late = s.items.find((i) => i._id === "late")!;
    await expect(
      unwrapDek(late.ownerWrappedDek!, newSecret),
    ).resolves.toBeDefined();
  });

  it("resumes an interrupted rotation without starting over (legacy shape)", async () => {
    // State an older app left: committed (new key + Prev), no archive, one
    // item already re-wrapped, one still on the previous key.
    const masterKey = await newMasterKey();
    const current = generateRecipientKeyPair();
    const previous = generateRecipientKeyPair();
    const currentPk = serializePublicKey(current.publicKey);
    const done = await wrapDek(await generateDek(), currentPk);
    const items: Row[] = [
      { _id: "done", ownerWrappedDek: done },
      {
        _id: "left",
        ownerWrappedDek: await wrapDek(
          await generateDek(),
          serializePublicKey(previous.publicKey),
        ),
      },
    ];
    const s = await setup();
    s.items.splice(0, s.items.length, ...items);
    s.recipients.clear();
    s.deps.masterKey = masterKey;
    s.deps.rootKey = null; // not needed to resume
    s.deps.user = {
      _id: OWNER,
      phraseSalt: "salt",
      publicKey: currentPk,
      encryptedAsymmetricSecretKey: await encryptText(
        serializeSecretKey(current.secretKey),
        masterKey,
      ),
      encryptedAsymmetricSecretKeyPrev: await encryptText(
        serializeSecretKey(previous.secretKey),
        masterKey,
      ),
    };

    await rotateVault(s.deps);

    expect(s.calls.rotate).toHaveLength(0);
    expect(s.calls.updates).toEqual(["left"]);
    await expect(
      unwrapDek(s.items[1].ownerWrappedDek!, current.secretKey),
    ).resolves.toBeDefined();
    // The previous secret moves into the archive instead of being dropped.
    const archived = JSON.parse(
      await decryptText(
        s.calls.finalize[0].encryptedRetiredSecretKeys,
        masterKey,
      ),
    ) as string[];
    expect(archived).toEqual([serializeSecretKey(previous.secretKey)]);
  });
});
