import {
  base64ToUint8,
  constantTimeStringEquals,
  uint8ToBase64,
  uint8ToHex,
} from "../encoding";
import {
  generateRecipientKeyPair,
  serializePublicKey,
  unwrapBytes,
  wrapBytes,
} from "../kem";
import { signBytes, verifyBytes } from "../sig";
import { hashTranscript, sixDigitCode, utf8 } from "../transcript";

/**
 * QR pairing (v2 workflow 8): a signed-in phone hands the MasterKey to a new
 * browser. The browser makes an ephemeral ML-KEM-768 keypair, a login secret
 * and a QR secret; the QR binds the session to a hash of its public key and
 * carries the QR secret, which never goes through Convex. The phone seals the
 * MasterKey and the QR secret to that key and signs the envelope with its
 * ML-DSA-65 identity key. Convex only relays ciphertext.
 *
 * The browser has no key of the account to check the signature against
 * except the one Convex serves, so the QR secret is what proves the envelope
 * comes from the phone that scanned its QR: Convex knows the browser key and
 * could seal and sign an envelope itself, but cannot put the QR secret in it.
 */

const KEY_HASH_BYTES = 16;
const QR_SECRET_BYTES = 16;
const ENVELOPE_VERSION = 2;
const CODE_CONTEXT = "keeplas/pairing-code/v1";
const ENVELOPE_MAX_AGE_MS = 5 * 60 * 1000;
const SIGNATURE_CONTEXT = "keeplas-pairing-v1";
const QR_PATH = "/link";

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const buf = new Uint8Array(bytes.byteLength);
  buf.set(bytes);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
}

function base64Url(bytes: Uint8Array): string {
  return uint8ToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** QR key hash: hex of the first 16 bytes of SHA-256(raw public key). */
export async function pairingKeyHash(publicKeyB64: string): Promise<string> {
  const digest = await sha256(base64ToUint8(publicKeyB64));
  return uint8ToHex(digest.subarray(0, KEY_HASH_BYTES));
}

export interface BrowserPairingKeys {
  /** Ephemeral ML-KEM-768 public key (base64), sent to `pairing.create`. */
  publicKey: string;
  /** Ephemeral secret key; keep in memory only, erase after pairing. */
  secretKey: Uint8Array;
  /** Login secret (base64url); redeemed by `signIn("pairing")`. */
  loginSecret: string;
  /** SHA-256 hex of `loginSecret`, sent to `pairing.create`. */
  loginSecretHash: string;
  /** QR secret (base64url): only in the QR, never sent to Convex. */
  qrSecret: string;
}

/** Browser: everything it needs before calling `pairing.create`. */
export async function generateBrowserPairingKeys(): Promise<BrowserPairingKeys> {
  const { publicKey, secretKey } = generateRecipientKeyPair();
  const loginSecret = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const loginSecretHash = uint8ToHex(
    await sha256(new TextEncoder().encode(loginSecret)),
  );
  return {
    publicKey: serializePublicKey(publicKey),
    secretKey,
    loginSecret,
    loginSecretHash,
    qrSecret: base64Url(
      crypto.getRandomValues(new Uint8Array(QR_SECRET_BYTES)),
    ),
  };
}

export interface PairingQr {
  sessionId: string;
  keyHash: string;
  origin: string;
  qrSecret: string;
}

/** `https://app.keeplas.com/link#s=<sessionId>&h=<keyHash>&k=<qrSecret>`. */
export function buildPairingQr(qr: PairingQr): string {
  const params = new URLSearchParams({
    s: qr.sessionId,
    h: qr.keyHash,
    k: qr.qrSecret,
  });
  return `${qr.origin}${QR_PATH}#${params.toString()}`;
}

/** Phone: parse a scanned QR. Returns null for anything else (invalid QR). */
export function parsePairingQr(text: string): PairingQr | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.pathname !== QR_PATH) return null;
  const params = new URLSearchParams(url.hash.slice(1));
  const sessionId = params.get("s");
  const keyHash = params.get("h");
  const qrSecret = params.get("k");
  if (
    !sessionId ||
    !keyHash ||
    !/^[0-9a-f]{32}$/.test(keyHash) ||
    !qrSecret ||
    !/^[A-Za-z0-9_-]{22}$/.test(qrSecret)
  ) {
    return null;
  }
  return { sessionId, keyHash, origin: url.origin, qrSecret };
}

/**
 * 6-digit code shown by the browser next to its QR and by the phone before
 * it approves: the person checks they approve the browser in front of them.
 */
export async function pairingCode(qr: PairingQr): Promise<string> {
  return sixDigitCode(
    await hashTranscript(CODE_CONTEXT, [
      utf8(qr.sessionId),
      utf8(qr.keyHash),
      utf8(qr.origin),
      utf8(qr.qrSecret),
    ]),
  );
}

interface EnvelopePayload {
  v: typeof ENVELOPE_VERSION;
  masterKey: string;
  userId: string;
  issuedAt: number;
  /** From the scanned QR: proves the phone saw it. */
  qrSecret: string;
}

function additionalData(
  sessionId: string,
  origin: string,
): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`${sessionId}|${origin}`);
}

function signedMessage(
  sessionId: string,
  origin: string,
  envelope: string,
): Uint8Array {
  return new TextEncoder().encode(
    `${SIGNATURE_CONTEXT}|${sessionId}|${origin}|${envelope}`,
  );
}

/**
 * Phone: seal the raw MasterKey and the QR secret to the browser key and
 * sign the result. Call only after `pairingKeyHash(browserPublicKey)` matched
 * the QR.
 */
export async function sealPairingEnvelope(args: {
  masterKey: Uint8Array;
  userId: string;
  browserPublicKey: string;
  sessionId: string;
  origin: string;
  qrSecret: string;
  identitySecretKey: string;
}): Promise<{ envelope: string; approvalSignature: string }> {
  const payload: EnvelopePayload = {
    v: ENVELOPE_VERSION,
    masterKey: uint8ToBase64(args.masterKey),
    userId: args.userId,
    issuedAt: Date.now(),
    qrSecret: args.qrSecret,
  };
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  try {
    const envelope = await wrapBytes(
      plaintext,
      args.browserPublicKey,
      additionalData(args.sessionId, args.origin),
    );
    const approvalSignature = signBytes(
      args.identitySecretKey,
      signedMessage(args.sessionId, args.origin, envelope),
    );
    return { envelope, approvalSignature };
  } finally {
    plaintext.fill(0);
  }
}

/**
 * Browser: verify the signature, open the envelope and check it carries the
 * secret of the QR this browser showed. Throws on a bad signature, a missing
 * or wrong QR secret (an envelope the relay sealed itself, or a phone app too
 * old to send it), another user, a stale envelope or a wrong key. Returns the
 * raw MasterKey; the caller erases `secretKey` either way.
 */
export async function openPairingEnvelope(args: {
  envelope: string;
  approvalSignature: string;
  secretKey: Uint8Array;
  sessionId: string;
  origin: string;
  qrSecret: string;
  identityPublicKey: string;
  userId: string;
  now?: number;
}): Promise<Uint8Array> {
  const signed = signedMessage(args.sessionId, args.origin, args.envelope);
  if (!verifyBytes(args.identityPublicKey, signed, args.approvalSignature)) {
    throw new Error("Pairing envelope signature is invalid");
  }
  const plaintext = await unwrapBytes(
    args.envelope,
    args.secretKey,
    additionalData(args.sessionId, args.origin),
  );
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(plaintext),
    ) as EnvelopePayload;
    if (
      payload.v !== ENVELOPE_VERSION ||
      typeof payload.qrSecret !== "string" ||
      !constantTimeStringEquals(payload.qrSecret, args.qrSecret)
    ) {
      throw new Error("Pairing envelope does not answer this QR code");
    }
    if (payload.userId !== args.userId) {
      throw new Error("Pairing envelope is for another account");
    }
    const age = (args.now ?? Date.now()) - payload.issuedAt;
    if (age < -60_000 || age > ENVELOPE_MAX_AGE_MS) {
      throw new Error("Pairing envelope expired");
    }
    return base64ToUint8(payload.masterKey);
  } finally {
    plaintext.fill(0);
  }
}
