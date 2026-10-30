import { useCallback } from "react";

import { DeviceLockError, saveDeviceVault } from "@/crypto/device-vault";
import { openKeyBundle } from "@/crypto/vault-keys";
import { useEnsureCloudBackup } from "@/features/cloud-backup";
import { useI18n } from "@/providers/i18n-provider";
import { useSession, useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";

/** The 24 words don't open this account's key bundle. */
export class WrongKitWords extends Error {
  constructor() {
    super("These words don't open the key bundle");
    this.name = "WrongKitWords";
  }
}

/**
 * The 24 words open the key bundle, then the key goes behind this phone's
 * screen lock. Resolves to the live MasterKey. Wrong words throw
 * {@link WrongKitWords}; a screen lock that refuses the key throws
 * DeviceLockError.
 */
export function useKitOpen() {
  const { t } = useI18n();
  const viewer = useViewer();
  const { adopt } = useVault();
  const { refreshDeviceVault } = useSession();
  const ensureCloudBackup = useEnsureCloudBackup();

  return useCallback(
    async (words: string) => {
      if (!viewer.encryptedKeyBundle) throw new Error("No vault to open");
      const keys = await openKeyBundle(
        viewer.encryptedKeyBundle,
        kitWords(words),
      ).catch(() => {
        throw new WrongKitWords();
      });
      await saveDeviceVault(viewer._id, keys, t("unlock.title"));
      void ensureCloudBackup(keys.rootKey);
      const key = await adopt(keys.masterKey);
      refreshDeviceVault();
      return key;
    },
    [viewer, adopt, refreshDeviceVault, ensureCloudBackup, t],
  );
}

/**
 * Why the vault didn't open on this phone, as an i18n key: only words that
 * don't open the key bundle blame the words, and a screen lock that refused
 * the key (prompt cancelled) says so. `fallback` covers anything else.
 */
export function vaultOpenErrorKey(
  error: unknown,
  fallback = "common.genericError",
): string {
  if (error instanceof WrongKitWords) return "recoveryKit.invalid";
  if (error instanceof DeviceLockError) return "recoveryKit.notKept";
  return fallback;
}

/**
 * The words of a kit as typed, pasted or read with Scan Text, lowercased.
 * The printed kit numbers its words ("01 apple", "1. apple"): numbers and
 * punctuation are dropped and, when every word has its number, the words
 * are put back in that order (a two-column kit may be read column by column).
 */
export function kitWords(text: string): string[] {
  const numbered: { n?: number; word: string }[] = [];
  let n: number | undefined;
  for (const token of text.toLowerCase().match(/[a-z]+|\d+/g) ?? []) {
    if (/\d/.test(token)) {
      n = Number(token);
    } else {
      numbered.push({ n, word: token });
      n = undefined;
    }
  }
  const ordered = numbered.every((entry) => entry.n !== undefined)
    ? [...numbered].sort((a, b) => a.n! - b.n!)
    : numbered;
  return ordered.map((entry) => entry.word);
}

/** A recovery kit is 24 words. */
export const isFullKit = (words: string) => kitWords(words).length === 24;

// The 24 words just typed to sign in after losing the number, so the next
// screen that opens the vault doesn't ask for them again. Memory only, read
// once.
let remembered: string | null = null;

export function rememberKit(words: string | null): void {
  remembered = words;
}

/** The remembered words (then forgotten), or "" to start empty. */
export function takeRememberedKit(): string {
  const words = remembered ?? "";
  remembered = null;
  return words;
}
