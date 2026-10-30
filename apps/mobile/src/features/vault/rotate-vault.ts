/**
 * On-phone master-key rotation. What it renews and what it does not (item
 * DEKs stay) is described in packages/convex/rotation.ts.
 *
 *  1. Start (no rotation in progress): verify every item recipient under the
 *     current key, so a contact that fails blocks BEFORE anything changes;
 *     generate the new keys; commit them atomically with the re-sealed
 *     category / folder names, the re-MACed contact pins and the retired-key
 *     archive; keep the new MasterKey on this phone at once.
 *  2. Re-wrap every item to the new owner key (and its recipients), until a
 *     fresh read shows none left on an older key. Idempotent.
 *  3. Finalize: a new kit (24 words, salt, RootKey) retires the old RootKey;
 *     this phone keeps the new RootKey first, then the server drops `…Prev`.
 *
 * A rotation interrupted anywhere resumes at step 2 on the next run (the
 * server refuses to start a second one while `…Prev` is set).
 */
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import type { api } from "@keeplas/backend/_generated/api";
import { generateMasterKey } from "@keeplas/crypto/aes";
import { serializeSecretKey, unwrapDek, wrapDek } from "@keeplas/crypto/kem";
import {
  carryOverPin,
  contactKeyMaterial,
  deriveContactTrust,
  type ContactTrust,
} from "@keeplas/crypto/sig";

import { requireVerifiedKey, type PersistPin } from "@/crypto/contact-keys";
import { decryptText, encryptText, exportRawKey } from "@/crypto/envelope";
import {
  loadOwnerKeys,
  sealRetiredSecretKeys,
  unwrapOwnerDek,
  type OwnerKeyFields,
} from "@/crypto/owner-keys";
import {
  buildKeyBundle,
  createKitMaterial,
  createPublicKeyMaterial,
} from "@/crypto/vault-keys";

type Items = FunctionReturnType<typeof api.rotation.getRotatableItems>;
type ItemId = Items[number]["_id"];
type Recipients = FunctionReturnType<typeof api.rotation.getItemRecipients>;
type Contacts = FunctionReturnType<typeof api.trusted_contacts.getContacts>;
type Args<F extends FunctionReference<"mutation">> = Omit<
  FunctionArgs<F>,
  "_audit"
>;
type RotateArgs = Args<typeof api.rotation.rotateKeyMaterial>;
type FinalizeArgs = Args<typeof api.rotation.finalizeRotation>;
type UpdateItemArgs = Args<typeof api.vault_items.updateItem>;
type Named<Id> = { _id: Id; encryptedName: string }[];

export interface RotationUser extends OwnerKeyFields {
  phraseSalt?: string;
}

export interface RotationDeps {
  /** The signed-in user as read before the rotation. */
  user: RotationUser;
  /** The MasterKey open on this phone. */
  masterKey: CryptoKey;
  /** This phone's RootKey: needed to start a rotation, not to resume one. */
  rootKey: Uint8Array | null;
  server: {
    items: () => Promise<Items>;
    recipients: (itemId: ItemId) => Promise<Recipients>;
    contacts: () => Promise<Contacts>;
    categories: () => Promise<Named<RotateArgs["categoryNames"][number]["id"]>>;
    folders: () => Promise<Named<RotateArgs["folderNames"][number]["id"]>>;
    rotate: (args: RotateArgs) => Promise<unknown>;
    updateItem: (args: UpdateItemArgs) => Promise<unknown>;
    finalize: (args: FinalizeArgs) => Promise<unknown>;
    pin: PersistPin;
  };
  /**
   * Keep keys on this phone (device vault) and open the vault with them.
   * Owns and wipes `masterKey`; never wipes `rootKey`.
   */
  keepKeys: (keys: {
    masterKey: Uint8Array;
    rootKey: Uint8Array | null;
  }) => Promise<void>;
  onProgress?: (done: number, total: number) => void;
}

/** Items still opened by the MasterKey itself: migrate them first. */
export class LegacyItemsError extends Error {}
/** Starting a rotation needs the RootKey on this phone. */
export class NoRootKeyError extends Error {}

/**
 * Rotate (or resume rotating) the vault keys. Resolves to the new raw
 * RootKey, which the caller owns (cloud backup re-seal, then wipe).
 */
export async function rotateVault(deps: RotationDeps): Promise<Uint8Array> {
  const items = await deps.server.items();
  if (items.some((item) => !item.ownerWrappedDek)) throw new LegacyItemsError();
  const current = deps.user.encryptedAsymmetricSecretKeyPrev
    ? {
        user: deps.user,
        masterKey: deps.masterKey,
        recipients: new Map(),
        verified: new Map(),
      }
    : await start(deps, items);
  await rewrapAll(deps, current);
  return finalize(deps, current.user, current.masterKey);
}

/** Where step 2 picks up: the committed key fields and MasterKey. */
interface Committed {
  user: OwnerKeyFields;
  masterKey: CryptoKey;
  /**
   * Recipients `start` read, used once by the first re-wrap pass (nothing
   * else writes in between: the commit signed the other sessions out).
   */
  recipients: Map<ItemId, Recipients>;
  /** Contact id → ML-KEM key already authenticated by `start`. */
  verified: Map<string, Promise<string>>;
}

/** Step 1. */
async function start(deps: RotationDeps, items: Items): Promise<Committed> {
  const { user, server, rootKey } = deps;
  if (!rootKey) throw new NoRootKeyError();
  if (!user.phraseSalt) throw new Error("Account has no key bundle");
  const oldKeys = await loadOwnerKeys(user, deps.masterKey);
  const from = await deriveContactTrust(user._id, deps.masterKey);

  // Every recipient must verify now: a blocked one after the commit would
  // leave the run half done. No pin is written before the commit.
  const recipients = new Map<ItemId, Recipients>();
  const verified = new Map<string, Promise<string>>();
  for (const item of items) {
    const list = await server.recipients(item._id);
    recipients.set(item._id, list);
    for (const recipient of list) {
      if (verified.has(recipient.contactId)) continue;
      const key = await requireVerifiedKey(
        material(recipient),
        from,
        async () => {},
      );
      verified.set(recipient.contactId, Promise.resolve(key));
    }
  }

  const newMaster = await generateMasterKey();
  const rawNew = await exportRawKey(newMaster);
  try {
    const next = await createPublicKeyMaterial(newMaster, user._id);
    const reseal = async <Id>(rows: Named<Id>) =>
      Promise.all(
        rows.map(async (row) => ({
          id: row._id,
          // A name the current key cannot open stays as it is.
          encryptedName: await decryptText(row.encryptedName, deps.masterKey)
            .then((name) => encryptText(name, newMaster))
            .catch(() => row.encryptedName),
        })),
      );
    const retired = {
      encryptedAsymmetricSecretKeyPrev: await encryptText(
        serializeSecretKey(oldKeys.secretKey),
        newMaster,
      ),
      encryptedRetiredSecretKeys: await sealRetiredSecretKeys(
        [oldKeys.secretKey, ...oldKeys.previousSecretKeys],
        newMaster,
      ),
    };
    await server.rotate({
      // Under the CURRENT RootKey: if this phone loses the response, the
      // RootKey it holds still opens the new bundle.
      encryptedKeyBundle: await buildKeyBundle(
        rawNew,
        rootKey,
        user.phraseSalt,
      ),
      ...next.publicKeys,
      ...retired,
      categoryNames: await reseal(await server.categories()),
      folderNames: await reseal(await server.folders()),
      contactPins: await carriedPins(
        await server.contacts(),
        from,
        await deriveContactTrust(user._id, newMaster),
      ),
    });
    await deps.keepKeys({ masterKey: rawNew.slice(), rootKey });
    return {
      user: { _id: user._id, ...next.publicKeys, ...retired },
      masterKey: newMaster,
      recipients,
      verified,
    };
  } finally {
    rawNew.fill(0);
  }
}

/** Step 2. */
async function rewrapAll(
  deps: RotationDeps,
  { user, masterKey, recipients: prefetched, verified }: Committed,
) {
  const { server } = deps;
  const keys = await loadOwnerKeys(user, masterKey);
  // Pins read from now on are MACed under the current MasterKey.
  const trust = await deriveContactTrust(user._id, masterKey);
  const keyOf = (recipient: Recipients[number]) => {
    let key = verified.get(recipient.contactId);
    if (!key) {
      key = requireVerifiedKey(material(recipient), trust, server.pin);
      verified.set(recipient.contactId, key);
    }
    return key;
  };
  const written = new Set<string>();
  let done = 0;
  for (;;) {
    const pending = (await server.items()).filter(
      (item) => !written.has(item.ownerWrappedDek ?? ""),
    );
    if (pending.length === 0) break;
    const total = done + pending.length;
    for (const item of pending) {
      const wrapped = item.ownerWrappedDek;
      if (!wrapped) throw new LegacyItemsError();
      // Already on the current key (an earlier, interrupted run).
      const migrated = await unwrapDek(wrapped, keys.secretKey).then(
        () => true,
        () => false,
      );
      if (!migrated) {
        const dek = await unwrapOwnerDek(wrapped, keys);
        const recipients =
          prefetched.get(item._id) ?? (await server.recipients(item._id));
        prefetched.delete(item._id);
        const ownerWrappedDek = await wrapDek(dek, keys.publicKey);
        await server.updateItem({
          itemId: item._id,
          ownerWrappedDek,
          recipientKeys: await Promise.all(
            recipients.map(async (recipient) => ({
              contactId: recipient.contactId,
              wrappedDek: await wrapDek(dek, await keyOf(recipient)),
            })),
          ),
        });
        written.add(ownerWrappedDek);
      } else {
        written.add(wrapped);
      }
      done += 1;
      deps.onProgress?.(done, total);
    }
  }
}

/** Step 3. Resolves to the new raw RootKey. */
async function finalize(
  deps: RotationDeps,
  user: OwnerKeyFields,
  masterKey: CryptoKey,
): Promise<Uint8Array> {
  const keys = await loadOwnerKeys(user, masterKey);
  const raw = await exportRawKey(masterKey);
  // The words are not shown: a paper kit is made later in Settings.
  const kit = await createKitMaterial(raw);
  try {
    // This phone first: if the server commit is lost, it still holds the
    // MasterKey, and the next run finalizes again with another kit.
    await deps.keepKeys({ masterKey: raw, rootKey: kit.rawRootKey });
    await deps.server.finalize({
      encryptedRetiredSecretKeys: await sealRetiredSecretKeys(
        keys.previousSecretKeys,
        masterKey,
      ),
      encryptedKeyBundle: kit.encryptedKeyBundle,
      phraseSalt: kit.phraseSalt,
      recoveryPhraseHash: kit.recoveryPhraseHash,
    });
    return kit.rawRootKey;
  } catch (error) {
    kit.rawRootKey.fill(0);
    throw error;
  }
}

const material = (recipient: Recipients[number]) =>
  contactKeyMaterial({ _id: recipient.contactId, ...recipient });

/**
 * Each pinned contact that verifies under the current key, its pin MACed
 * under the next one. One that fails keeps its pin (the owner re-trusts it
 * explicitly later); recipients were already checked.
 */
async function carriedPins(
  contacts: Contacts,
  from: ContactTrust,
  to: ContactTrust,
): Promise<RotateArgs["contactPins"]> {
  const pins: RotateArgs["contactPins"] = [];
  for (const contact of contacts) {
    if (!contact.pinnedIdentityFingerprint) continue;
    const outcome = await carryOverPin(contactKeyMaterial(contact), from, to);
    if (outcome.status === "ok" && outcome.pin) {
      pins.push({ contactId: contact._id, ...outcome.pin });
    }
  }
  return pins;
}
