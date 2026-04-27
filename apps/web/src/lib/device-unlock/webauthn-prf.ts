import { uint8ToBase64, base64ToUint8 } from "@keeplas/crypto/encoding";
import {
  DeviceUnlockEntry,
  DeviceUnlockError,
  WebAuthnPrfEntryData,
} from "./types";
import {
  exportMasterKey,
  importMasterKey,
  importWrapKeyFromBytes,
  unwrapWithKey,
  wrapWithKey,
} from "./key-import";
import { putEntry } from "./storage";

const RP_NAME = "Keeplas";

function rpId(): string {
  if (typeof window === "undefined") return "localhost";
  return window.location.hostname;
}

function fromBase64Url(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(b64url.length / 4) * 4,
    "="
  );
  return base64ToUint8(b64);
}

function toBase64Url(bytes: Uint8Array | ArrayBuffer): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return uint8ToBase64(u).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}

interface PrfExtensionResults {
  results?: { first?: ArrayBuffer | undefined };
}

interface PrfClientExtensionResults {
  prf?: PrfExtensionResults;
}

function getPrfFirst(
  cred: PublicKeyCredential | null
): Uint8Array | null {
  if (!cred) return null;
  const ext = (cred.getClientExtensionResults() as
    | PrfClientExtensionResults
    | undefined);
  const first = ext?.prf?.results?.first;
  if (!first) return null;
  return new Uint8Array(first);
}

async function createCredentialWithPrf(
  attachment: "platform" | "cross-platform",
  userEmail: string,
  prfSalt: Uint8Array
): Promise<PublicKeyCredential> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { id: rpId(), name: RP_NAME },
      user: {
        id: userId,
        name: userEmail,
        displayName: userEmail,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: attachment,
        userVerification: "required",
        residentKey: "required",
      },
      timeout: 60_000,
      extensions: {
        prf: { eval: { first: prfSalt } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!credential) {
    throw new DeviceUnlockError("Credential creation failed", "cancelled");
  }
  return credential;
}

async function evalPrf(
  credentialId: Uint8Array,
  prfSalt: Uint8Array
): Promise<Uint8Array> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credIdBuf = new Uint8Array(credentialId.byteLength);
  credIdBuf.set(credentialId);
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: rpId(),
      allowCredentials: [
        {
          type: "public-key",
          id: credIdBuf,
        },
      ],
      userVerification: "required",
      timeout: 60_000,
      extensions: {
        prf: { eval: { first: prfSalt } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  const prf = getPrfFirst(assertion);
  if (!prf) {
    throw new DeviceUnlockError(
      "Authenticator does not support PRF or did not return a value",
      "unsupported"
    );
  }
  return prf;
}

function detectLabel(attachment: "platform" | "cross-platform"): string {
  if (attachment === "cross-platform") return "Hardware security key";
  if (typeof navigator === "undefined") return "Biometric unlock";
  const ua = navigator.userAgent;
  if (/iPhone|iPad/i.test(ua)) return "Face ID / Touch ID";
  if (/Macintosh/i.test(ua)) return "Touch ID";
  if (/Android/i.test(ua)) return "Biometric unlock";
  if (/Windows/i.test(ua)) return "Windows Hello";
  return "Biometric unlock";
}

export async function enrollWebAuthnPrf(
  userEmail: string,
  masterKey: CryptoKey,
  attachment: "platform" | "cross-platform",
  label?: string
): Promise<DeviceUnlockEntry> {
  if (!isWebAuthnSupported()) {
    throw new DeviceUnlockError("WebAuthn not supported", "unsupported");
  }
  const prfSalt = crypto.getRandomValues(new Uint8Array(32));
  let credential: PublicKeyCredential;
  try {
    credential = await createCredentialWithPrf(attachment, userEmail, prfSalt);
  } catch (err) {
    if ((err as Error).name === "NotAllowedError") {
      throw new DeviceUnlockError("User cancelled", "cancelled", { cause: err });
    }
    throw new DeviceUnlockError(
      "Could not create credential",
      "unsupported",
      { cause: err }
    );
  }

  const credentialId = new Uint8Array(credential.rawId);

  // Many platforms don't return PRF on create() — call get() once to fetch it.
  const prfSecret = await evalPrf(credentialId, prfSalt);
  const wrapKey = await importWrapKeyFromBytes(prfSecret);

  const raw = await exportMasterKey(masterKey);
  try {
    const { iv, wrapped } = await wrapWithKey(raw, wrapKey);
    const entry: DeviceUnlockEntry = {
      id: crypto.randomUUID(),
      userEmail,
      method: attachment === "platform" ? "biometric" : "hardware-key",
      label: label || detectLabel(attachment),
      createdAt: Date.now(),
      data: {
        kind: "webauthn-prf",
        attachment,
        credentialId: toBase64Url(credentialId),
        prfSalt: uint8ToBase64(prfSalt),
        iv,
        wrappedMasterKey: wrapped,
      } satisfies WebAuthnPrfEntryData,
    };
    await putEntry(entry);
    return entry;
  } finally {
    raw.fill(0);
    prfSecret.fill(0);
  }
}

export async function unlockWithWebAuthnPrf(
  entry: DeviceUnlockEntry
): Promise<CryptoKey> {
  if (entry.data.kind !== "webauthn-prf") {
    throw new DeviceUnlockError("Entry is not a WebAuthn entry", "io");
  }
  if (!isWebAuthnSupported()) {
    throw new DeviceUnlockError("WebAuthn not supported", "unsupported");
  }
  const credentialId = fromBase64Url(entry.data.credentialId);
  const prfSalt = base64ToUint8(entry.data.prfSalt);
  let prfSecret: Uint8Array;
  try {
    prfSecret = await evalPrf(credentialId, prfSalt);
  } catch (err) {
    if ((err as Error).name === "NotAllowedError") {
      throw new DeviceUnlockError("User cancelled", "cancelled", { cause: err });
    }
    if (err instanceof DeviceUnlockError) throw err;
    throw new DeviceUnlockError(
      "Authentication failed",
      "wrong-secret",
      { cause: err }
    );
  }
  try {
    const wrapKey = await importWrapKeyFromBytes(prfSecret);
    const raw = await unwrapWithKey(
      entry.data.wrappedMasterKey,
      entry.data.iv,
      wrapKey
    );
    try {
      return await importMasterKey(raw);
    } finally {
      raw.fill(0);
    }
  } finally {
    prfSecret.fill(0);
  }
}
