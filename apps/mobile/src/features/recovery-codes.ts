import * as SecureStore from "expo-secure-store";
import {
  generateRecipientKeyPair,
  parseSecretKey,
  publicKeyFromSecretKey,
  serializePublicKey,
  serializeSecretKey,
} from "@keeplas/crypto/kem";
import {
  newRecoveryNonce,
  recoveryCode,
  recoveryCommitment,
} from "@keeplas/crypto/social";

/**
 * D4 recovery codes on the phones (commit-then-reveal, see `recoveryCode` in
 * @keeplas/crypto/social). Each side keeps on the phone what it must never
 * take from Keeplas again: the recovering device its key and nonces, the
 * contact the commitment it answered and its own nonce.
 */

/** Small key-value store: SecureStore in the app, a Map in tests. */
export interface CodeStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const secureCodeStore: CodeStore = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key),
};

async function readJson<T>(store: CodeStore, key: string): Promise<T | null> {
  const raw = await store.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

/** Runs tasks one after the other: queries update faster than storage. */
export function serialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  };
}

export type CodeState =
  { kind: "waiting" } | { kind: "mismatch" } | { kind: "ready"; code: string };

// ─── Recovering device ────────────────────────────────────────────────────

// Same name as before the code exchange, so requests in flight still finish.
const deviceKeyName = (userId: string) => `keeplas.recovery-device.${userId}`;
const deviceCodesName = (userId: string) => `keeplas.recovery-codes.${userId}`;

interface DeviceCodes {
  requestId: string;
  contacts: Record<
    string,
    { commitment: string; deviceNonce: string; contactNonce?: string }
  >;
}

/** New device: a fresh key pair whose secret never leaves this phone. */
export async function createRecoveryKey(
  store: CodeStore,
  userId: string,
): Promise<string> {
  const pair = generateRecipientKeyPair();
  await store.remove(deviceCodesName(userId));
  await store.set(deviceKeyName(userId), serializeSecretKey(pair.secretKey));
  pair.secretKey.fill(0);
  return serializePublicKey(pair.publicKey);
}

/**
 * The key this phone made, its public half read from the secret key: never
 * the copy Keeplas returns. Null on a phone that did not start a request.
 */
export async function loadRecoveryKey(
  store: CodeStore,
  userId: string,
): Promise<{ publicKey: string; secretKey: Uint8Array } | null> {
  const stored = await store.get(deviceKeyName(userId));
  if (!stored) return null;
  const secretKey = parseSecretKey(stored);
  return {
    publicKey: serializePublicKey(publicKeyFromSecretKey(secretKey)),
    secretKey,
  };
}

export async function clearRecoveryKey(store: CodeStore, userId: string) {
  await store.remove(deviceKeyName(userId));
  await store.remove(deviceCodesName(userId));
}

/** `recovery.getMyRequest`, the fields the code exchange reads. */
export interface OwnRequest {
  requestId: string;
  contacts: {
    contactId: string;
    decision: string | null;
    commitment: string | null;
    contactNonce: string | null;
    revealed: boolean;
  }[];
}

/**
 * Recovering device, on every update of its request: commit for contacts
 * without a commitment, keep each contact nonce the first time it shows up,
 * reveal, and return each undecided contact's code. A commitment this phone
 * never made, or a contact nonce that changed, is a mismatch.
 */
export async function syncDeviceCodes(args: {
  store: CodeStore;
  userId: string;
  publicKey: string;
  request: OwnRequest;
  commit: (
    commitments: { contactId: string; commitment: string }[],
  ) => Promise<unknown>;
  reveal: (contactId: string, deviceNonce: string) => Promise<unknown>;
}): Promise<Record<string, CodeState>> {
  const { store, request } = args;
  const name = deviceCodesName(args.userId);
  const saved = await readJson<DeviceCodes>(store, name);
  const codes: DeviceCodes =
    saved?.requestId === request.requestId
      ? saved
      : { requestId: request.requestId, contacts: {} };
  const undecided = request.contacts.filter((c) => c.decision === null);

  const toCommit = [];
  for (const contact of undecided) {
    let mine = codes.contacts[contact.contactId];
    if (!mine && contact.commitment === null) {
      const deviceNonce = newRecoveryNonce();
      mine = {
        deviceNonce,
        commitment: await recoveryCommitment(args.publicKey, deviceNonce),
      };
      codes.contacts[contact.contactId] = mine;
    }
    if (mine && contact.commitment === null) {
      toCommit.push({
        contactId: contact.contactId,
        commitment: mine.commitment,
      });
    }
    if (mine && !mine.contactNonce && contact.contactNonce !== null) {
      mine.contactNonce = contact.contactNonce;
    }
  }
  // Kept before anything leaves the phone: a nonce is never made twice.
  await store.set(name, JSON.stringify(codes));
  if (toCommit.length > 0) await args.commit(toCommit);

  const states: Record<string, CodeState> = {};
  for (const contact of undecided) {
    const mine = codes.contacts[contact.contactId];
    if (contact.commitment === null) {
      states[contact.contactId] = { kind: "waiting" };
    } else if (
      !mine ||
      contact.commitment !== mine.commitment ||
      (contact.contactNonce !== null &&
        contact.contactNonce !== mine.contactNonce)
    ) {
      states[contact.contactId] = { kind: "mismatch" };
    } else if (!mine.contactNonce) {
      states[contact.contactId] = { kind: "waiting" };
    } else {
      if (!contact.revealed) {
        await args.reveal(contact.contactId, mine.deviceNonce);
      }
      states[contact.contactId] = {
        kind: "ready",
        code: await recoveryCode({
          requestId: request.requestId,
          contactId: contact.contactId,
          devicePublicKey: args.publicKey,
          commitment: mine.commitment,
          deviceNonce: mine.deviceNonce,
          contactNonce: mine.contactNonce,
        }),
      };
    }
  }
  return states;
}

// ─── Trust contact ────────────────────────────────────────────────────────

const answerName = (requestId: string) =>
  `keeplas.recovery-answer.${requestId}`;

interface ContactAnswer {
  commitment: string;
  contactNonce: string;
}

/** `recovery.getRequestsForMe`, the fields the code exchange reads. */
export interface RequestForMe {
  requestId: string;
  contactId: string;
  newDevicePublicKey: string;
  commitment: string | null;
  contactNonce: string | null;
  deviceNonce: string | null;
}

export type ContactCodeState =
  | Exclude<CodeState, { kind: "ready" }>
  /** Answered from another phone or before a reinstall: no code here. */
  | { kind: "elsewhere" }
  /** `devicePublicKey` opened the commitment: the key to seal the share to. */
  | { kind: "ready"; code: string; devicePublicKey: string };

/**
 * Contact, on every update of the request: answer the commitment once with
 * a nonce kept on this phone, then compute the code when the device reveals.
 * A `ready` state carries the device key the commitment was opened with:
 * seal the share to that one, not to a later copy of the request.
 */
export async function syncContactCode(args: {
  store: CodeStore;
  request: RequestForMe;
  answer: (contactNonce: string) => Promise<unknown>;
}): Promise<ContactCodeState> {
  const { store, request } = args;
  if (request.commitment === null) return { kind: "waiting" };
  const name = answerName(request.requestId);
  let mine = await readJson<ContactAnswer>(store, name);
  if (!mine) {
    if (request.contactNonce !== null) return { kind: "elsewhere" };
    mine = { commitment: request.commitment, contactNonce: newRecoveryNonce() };
    await store.set(name, JSON.stringify(mine));
  }
  if (
    mine.commitment !== request.commitment ||
    (request.contactNonce !== null &&
      request.contactNonce !== mine.contactNonce)
  ) {
    return { kind: "mismatch" };
  }
  if (request.contactNonce === null) await args.answer(mine.contactNonce);
  if (request.deviceNonce === null) return { kind: "waiting" };
  try {
    return {
      kind: "ready",
      code: await recoveryCode({
        requestId: request.requestId,
        contactId: request.contactId,
        devicePublicKey: request.newDevicePublicKey,
        commitment: mine.commitment,
        deviceNonce: request.deviceNonce,
        contactNonce: mine.contactNonce,
      }),
      devicePublicKey: request.newDevicePublicKey,
    };
  } catch {
    // The reveal does not open the commitment: key or nonce swapped.
    return { kind: "mismatch" };
  }
}

/** Contact, once it answered the request: drop what it kept for it. */
export async function forgetContactCode(store: CodeStore, requestId: string) {
  await store.remove(answerName(requestId));
}
