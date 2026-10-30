import { decrypt, encrypt } from "../aes";
import { base64ToUint8, uint8ToBase64 } from "../encoding";
import { parsePublicKey, unwrapBytes, wrapBytes } from "../kem";
import { reconstruct, split } from "../shamir";
import { signBytes, verifyBytes } from "../sig";
import { hashTranscript, sixDigitCode, utf8 } from "../transcript";

/**
 * Owner recovery with trust contacts (v2 workflow 7, F3).
 *
 * The MasterKey is never split. A random Recovery Secret RS is split 2-of-n
 * between the trust contacts (each share sealed to the contact's ML-KEM
 * key); a random gate key G is held by Keeplas under KMS. The social envelope
 * is AES-GCM(HKDF(RS ‖ G), MasterKey). Contacts alone (RS) or Keeplas alone
 * (G) open nothing; G is released to a new device only after 2 signed
 * approvals and the 72 h protection window.
 */

export const RECOVERY_THRESHOLD = 2;
const SECRET_BYTES = 32;
const HKDF_INFO = "keeplas/social-envelope/v1";
const APPROVAL_CONTEXT = "keeplas-recovery-approval-v1";
const CODE_NONCE_BYTES = 32;
const COMMITMENT_CONTEXT = "keeplas/recovery-commitment/v2";
const CODE_CONTEXT = "keeplas/recovery-code/v2";

/** AAD of a contact's share of RS. */
const shareAad = (userId: string, contactId: string, generation: number) =>
  utf8(`keeplas/rs-share|${userId}|${contactId}|${generation}`);

/** AAD of a share re-sealed by a contact to the recovering device. */
const deviceShareAad = (requestId: string) =>
  utf8(`keeplas/rs-device|${requestId}`);

/** AAD of the gate key G sealed by Keeplas to the recovering device. */
export const gateKeyAad = (requestId: string) =>
  utf8(`keeplas/gate|${requestId}`);

const envelopeAad = (userId: string, generation: number) =>
  utf8(`keeplas/social|${userId}|${generation}`);

async function envelopeKey(rs: Uint8Array, g: Uint8Array): Promise<CryptoKey> {
  const ikm = new Uint8Array(rs.length + g.length);
  ikm.set(rs);
  ikm.set(g, rs.length);
  try {
    const base = await crypto.subtle.importKey("raw", ikm, "HKDF", false, [
      "deriveKey",
    ]);
    return await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(0),
        info: utf8(HKDF_INFO),
      },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  } finally {
    ikm.fill(0);
  }
}

export interface TrustContactKey {
  contactId: string;
  /** Contact's ML-KEM-768 public key (base64), verified against its pin. */
  publicKey: string;
}

export interface SocialRecoverySetup {
  generation: number;
  /** Gate key G (base64); sent once to Keeplas, which stores it under KMS. */
  gateKey: string;
  socialEnvelope: string;
  shares: { contactId: string; wrappedShare: string }[];
}

/**
 * Owner device: (re)create the recovery material for `generation`. Needs at
 * least 2 trust contacts whose keys were verified (TOFU pin) beforehand.
 */
export async function createSocialRecovery(args: {
  masterKey: Uint8Array;
  userId: string;
  generation: number;
  contacts: TrustContactKey[];
}): Promise<SocialRecoverySetup> {
  const n = args.contacts.length;
  if (n < RECOVERY_THRESHOLD) {
    throw new Error(
      `Social recovery needs at least ${RECOVERY_THRESHOLD} trust contacts`,
    );
  }
  const rs = crypto.getRandomValues(new Uint8Array(SECRET_BYTES));
  const g = crypto.getRandomValues(new Uint8Array(SECRET_BYTES));
  try {
    const rawShares = await split(rs, n, RECOVERY_THRESHOLD);
    const shares = await Promise.all(
      args.contacts.map(async (contact, i) => {
        const wrappedShare = await wrapBytes(
          rawShares[i],
          contact.publicKey,
          shareAad(args.userId, contact.contactId, args.generation),
        );
        rawShares[i].fill(0);
        return { contactId: contact.contactId, wrappedShare };
      }),
    );
    const key = await envelopeKey(rs, g);
    const sealed = await encrypt(
      new Uint8Array(args.masterKey),
      key,
      envelopeAad(args.userId, args.generation),
    );
    const socialEnvelope = JSON.stringify({
      v: 1,
      iv: uint8ToBase64(sealed.iv),
      ct: uint8ToBase64(new Uint8Array(sealed.ciphertext)),
    });
    return {
      generation: args.generation,
      gateKey: uint8ToBase64(g),
      socialEnvelope,
      shares,
    };
  } finally {
    rs.fill(0);
    g.fill(0);
  }
}

/**
 * The 6-digit code the owner and each contact compare on a call (D4) is a
 * commit-then-reveal short authentication string, one per contact:
 *
 *   1. recovering device: secret nonce r, commitment H(device key ‖ r)
 *   2. contact: sees (device key, commitment), keeps the commitment, sends
 *      its own nonce s
 *   3. device: keeps the s it received, then reveals r
 *   4. both: code(requestId, contactId, device key, r, s); the contact first
 *      checks that r opens the commitment it kept
 *
 * Keeplas relays every step. To swap the device key it must commit to its
 * own nonce before it sees s, and pick the s the device gets before it sees
 * r: the two codes then match with a 1-in-10^6 chance, and a miss shows up on
 * the call. Each side must keep what it received (commitment, s) on the
 * device: a server that could change them after the reveal could grind a
 * matching code.
 */

/** Device or contact: a fresh nonce (base64, 32 bytes) for one code. */
export function newRecoveryNonce(): string {
  return uint8ToBase64(
    crypto.getRandomValues(new Uint8Array(CODE_NONCE_BYTES)),
  );
}

function parseNonce(nonce: string): Uint8Array {
  const bytes = base64ToUint8(nonce);
  if (bytes.length !== CODE_NONCE_BYTES || uint8ToBase64(bytes) !== nonce) {
    throw new Error("Invalid recovery code nonce");
  }
  return bytes;
}

/** Recovering device: commitment to `deviceNonce` for one contact. */
export async function recoveryCommitment(
  devicePublicKey: string,
  deviceNonce: string,
): Promise<string> {
  return uint8ToBase64(
    await hashTranscript(COMMITMENT_CONTEXT, [
      parsePublicKey(devicePublicKey),
      parseNonce(deviceNonce),
    ]),
  );
}

/**
 * The code for one contact, on either side. Throws when `deviceNonce` does
 * not open `commitment` for `devicePublicKey` (a swapped key or nonce).
 */
export async function recoveryCode(args: {
  requestId: string;
  contactId: string;
  devicePublicKey: string;
  commitment: string;
  deviceNonce: string;
  contactNonce: string;
}): Promise<string> {
  const opened = await recoveryCommitment(
    args.devicePublicKey,
    args.deviceNonce,
  );
  if (opened !== args.commitment) {
    throw new Error("Recovery code commitment does not match");
  }
  const digest = await hashTranscript(CODE_CONTEXT, [
    utf8(args.requestId),
    utf8(args.contactId),
    parsePublicKey(args.devicePublicKey),
    parseNonce(args.deviceNonce),
    parseNonce(args.contactNonce),
  ]);
  return sixDigitCode(digest);
}

function approvalMessage(args: {
  requestId: string;
  contactId: string;
  devicePublicKey: string;
  wrappedShareForDevice: string;
}): Uint8Array {
  return utf8(
    [
      APPROVAL_CONTEXT,
      args.requestId,
      args.contactId,
      args.devicePublicKey,
      args.wrappedShareForDevice,
    ].join("|"),
  );
}

/**
 * Contact device, after the code matched on a call: open its RS share and
 * re-seal it to the recovering device, signed with the contact's identity
 * key. The contact never sees the MasterKey.
 */
export async function approveRecovery(args: {
  wrappedShare: string;
  contactSecretKey: Uint8Array;
  contactIdentitySecretKey: string;
  ownerUserId: string;
  contactId: string;
  generation: number;
  requestId: string;
  devicePublicKey: string;
}): Promise<{ wrappedShareForDevice: string; signature: string }> {
  const share = await unwrapBytes(
    args.wrappedShare,
    args.contactSecretKey,
    shareAad(args.ownerUserId, args.contactId, args.generation),
  );
  try {
    const wrappedShareForDevice = await wrapBytes(
      share,
      args.devicePublicKey,
      deviceShareAad(args.requestId),
    );
    const signature = signBytes(
      args.contactIdentitySecretKey,
      approvalMessage({ ...args, wrappedShareForDevice }),
    );
    return { wrappedShareForDevice, signature };
  } finally {
    share.fill(0);
  }
}

/** Check a contact's approval signature against its (pinned) identity key. */
export function verifyRecoveryApproval(args: {
  requestId: string;
  contactId: string;
  devicePublicKey: string;
  wrappedShareForDevice: string;
  signature: string;
  contactIdentityPublicKey: string;
}): boolean {
  return verifyBytes(
    args.contactIdentityPublicKey,
    approvalMessage(args),
    args.signature,
  );
}

/**
 * Recovering device, once Keeplas released G: verify the approvals,
 * rebuild RS from 2 shares and open the social envelope. Returns the raw
 * MasterKey; the caller then renews the recovery material (new generation).
 */
export async function openSocialRecovery(args: {
  ownerUserId: string;
  generation: number;
  requestId: string;
  devicePublicKey: string;
  deviceSecretKey: Uint8Array;
  wrappedGateKey: string;
  socialEnvelope: string;
  approvals: {
    contactId: string;
    wrappedShareForDevice: string;
    signature: string;
    contactIdentityPublicKey: string;
  }[];
}): Promise<Uint8Array> {
  const valid = args.approvals.filter((a) =>
    verifyRecoveryApproval({
      ...a,
      requestId: args.requestId,
      devicePublicKey: args.devicePublicKey,
    }),
  );
  if (new Set(valid.map((a) => a.contactId)).size < RECOVERY_THRESHOLD) {
    throw new Error("Not enough valid contact approvals");
  }
  const shares = await Promise.all(
    valid
      .slice(0, RECOVERY_THRESHOLD)
      .map((a) =>
        unwrapBytes(
          a.wrappedShareForDevice,
          args.deviceSecretKey,
          deviceShareAad(args.requestId),
        ),
      ),
  );
  const g = await unwrapBytes(
    args.wrappedGateKey,
    args.deviceSecretKey,
    gateKeyAad(args.requestId),
  );
  const rs = await reconstruct(shares);
  try {
    const key = await envelopeKey(rs, g);
    const env = JSON.parse(args.socialEnvelope) as {
      v: 1;
      iv: string;
      ct: string;
    };
    return new Uint8Array(
      await decrypt(
        base64ToUint8(env.ct),
        key,
        base64ToUint8(env.iv),
        envelopeAad(args.ownerUserId, args.generation),
      ),
    );
  } finally {
    rs.fill(0);
    g.fill(0);
    for (const s of shares) s.fill(0);
  }
}
