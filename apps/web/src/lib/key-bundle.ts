/**
 * Parsed shape of the `encryptedKeyBundle` JSON envelope stored in Convex.
 *
 * Only V2 (phrase-derived) bundles are supported by the client. Legacy V1
 * bundles carried a server-stored plaintext `wrappingKey`, which made the
 * master key server-decryptable — a zero-knowledge violation. The client no
 * longer unwraps V1; such accounts must be re-keyed.
 */
export interface ParsedKeyBundle {
  version?: number;
  phraseSalt?: string;
  /** Legacy V1 only: server-stored plaintext wrapping key. NOT zero-knowledge. */
  wrappingKey?: string;
  iv?: string;
  encryptedMasterKey?: string;
}

export type KeyBundleKind = "none" | "v2" | "legacy-v1";

/** Parse the stored JSON envelope, or null if absent / malformed. */
export function parseKeyBundle(
  bundleString: string | null,
): ParsedKeyBundle | null {
  if (!bundleString) return null;
  try {
    return JSON.parse(bundleString) as ParsedKeyBundle;
  } catch {
    return null;
  }
}

/**
 * Classify a parsed bundle so the unlock gate can decide how to handle it.
 *
 * - `legacy-v1`: carries a server-stored `wrappingKey`; blocked, needs re-key.
 * - `v2`: phrase-derived material (phraseSalt + iv + encryptedMasterKey, no
 *   wrappingKey); goes through the unlock flow. The `version` field is not
 *   required — shape detection avoids leaving V2-shaped bundles with a disabled
 *   vault when the field is missing.
 * - `none`: no usable bundle (e.g. mid-onboarding).
 */
export function classifyKeyBundle(
  bundle: ParsedKeyBundle | null,
): KeyBundleKind {
  if (!bundle) return "none";
  if ("wrappingKey" in bundle) return "legacy-v1";
  if (bundle.phraseSalt && bundle.iv && bundle.encryptedMasterKey) {
    return "v2";
  }
  return "none";
}
