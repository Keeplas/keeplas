import { parsePublicKey } from "../kem";
import { signBytesAsync, verifyBytesAsync } from "./mldsa";

/**
 * ML-KEM key binding: a user's ML-DSA identity key signs their ML-KEM public
 * key, so a contact can detect a server-substituted encryption key.
 *
 *  - v1 signs `keeplas/kem-binding/v1|<userId>|` followed by the raw 1184 key
 *    bytes. The label keeps the signature useless in any other protocol, and
 *    the userId ties the key to its account (another user's genuine triple
 *    cannot be attached to this contact).
 *  - v0 (accounts keyed before v1) signed the raw key bytes alone. It still
 *    verifies so those accounts keep working; the owner's authenticated pin
 *    records the version a contact was trusted with (contact-trust.ts), so a
 *    v1 contact cannot be downgraded to v0.
 */
export type KemBindingVersion = 0 | 1;

const KEM_BINDING_V1 = "keeplas/kem-binding/v1";

function v1Message(userId: string, kemPublicKey: Uint8Array): Uint8Array {
  const prefix = new TextEncoder().encode(`${KEM_BINDING_V1}|${userId}|`);
  const message = new Uint8Array(prefix.length + kemPublicKey.length);
  message.set(prefix);
  message.set(kemPublicKey, prefix.length);
  return message;
}

/** Sign `userId`'s ML-KEM public key (v1) with their identity secret key. */
export function signKemBinding(
  identitySecretKeyB64: string,
  userId: string,
  kemPublicKeyB64: string,
): Promise<string> {
  return signBytesAsync(
    identitySecretKeyB64,
    v1Message(userId, parsePublicKey(kemPublicKeyB64)),
  );
}

/**
 * The binding version `signature` verifies under, or null when it verifies
 * under none. v1 is only tried when the key's `userId` is known. Never throws.
 */
export async function verifyKemBinding(args: {
  identityPublicKey: string;
  kemPublicKey: string;
  signature: string;
  userId?: string;
}): Promise<KemBindingVersion | null> {
  let kemPublicKey: Uint8Array;
  try {
    kemPublicKey = parsePublicKey(args.kemPublicKey);
  } catch {
    return null;
  }
  if (
    args.userId &&
    (await verifyBytesAsync(
      args.identityPublicKey,
      v1Message(args.userId, kemPublicKey),
      args.signature,
    ))
  ) {
    return 1;
  }
  if (
    await verifyBytesAsync(args.identityPublicKey, kemPublicKey, args.signature)
  ) {
    return 0;
  }
  return null;
}
