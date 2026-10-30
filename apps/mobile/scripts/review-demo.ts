// The store review demo accounts (runbook: apps/mobile/APP_REVIEW.md → Demo
// accounts), shared by review-seed.ts and `pnpm review:status`
// (scripts/review-accounts.mjs). The three accounts share one set of 24
// words, REVIEW_KIT in Infisical prod /keeplas_mobile. They are never printed.
import { spawnSync } from "node:child_process";
import { base64ToUint8 } from "@keeplas/crypto/encoding";
import { derivePhraseVerifier } from "@keeplas/crypto/recovery";

export const OWNER = { phone: "+447700900101", name: "Demo Owner" };
export const ALEX = { phone: "+447700900102", name: "Alex Demo" };
export const SAM = { phone: "+447700900103", name: "Sam Demo" };
export const DEMO_PEOPLE = [OWNER, ALEX, SAM];
/** What review-seed.ts gives Alex and Sam each: a vault of their own. */
export const CONTACT_SEED = { items: 2, contacts: 0 };

export const KIT = "REVIEW_KIT";
export const KIT_PATH = ["--env=prod", "--path=/keeplas_mobile", "--silent"];

/** REVIEW_KIT's words; throws when Infisical can't give them. */
export function readKit(): string[] {
  const res = spawnSync(
    "infisical",
    ["secrets", "get", KIT, ...KIT_PATH, "--plain"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (res.status !== 0) {
    throw new Error(`infisical secrets get failed: ${res.stderr.trim()}`);
  }
  return res.stdout.trim().split(/\s+/);
}

/**
 * Whether `kit` still opens an account: its stored verifier
 * (users.recoveryPhraseHash) is the one the app derives from these words and
 * the account's salt (crypto/vault-keys.ts createKitMaterial). A kit made
 * again on the account gives it new words, and this turns false.
 */
export async function kitOpens(
  kit: string[],
  verifier: { phraseSalt: string; recoveryPhraseHash: string },
): Promise<boolean> {
  return (
    (await derivePhraseVerifier(kit, base64ToUint8(verifier.phraseSalt))) ===
    verifier.recoveryPhraseHash
  );
}
