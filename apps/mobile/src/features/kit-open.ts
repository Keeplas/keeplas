import { useCallback } from "react";

import { saveDeviceVault } from "@/crypto/device-vault";
import { openKeyBundle } from "@/crypto/vault-keys";
import { useI18n } from "@/providers/i18n-provider";
import { useSession, useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";

/**
 * The 24 words open the key bundle, then the key goes behind this phone's
 * screen lock. Resolves to the live MasterKey; wrong words throw.
 */
export function useKitOpen() {
  const { t } = useI18n();
  const viewer = useViewer();
  const { adopt } = useVault();
  const { refreshDeviceVault } = useSession();

  return useCallback(
    async (words: string) => {
      if (!viewer.encryptedKeyBundle) throw new Error("No vault to open");
      const keys = await openKeyBundle(viewer.encryptedKeyBundle, words);
      await saveDeviceVault(viewer._id, keys, t("unlock.title"));
      keys.rootKey.fill(0);
      const key = await adopt(keys.masterKey);
      refreshDeviceVault();
      return key;
    },
    [viewer, adopt, refreshDeviceVault, t],
  );
}

/** A recovery kit is 24 words separated by spaces. */
export const isFullKit = (words: string) =>
  words.trim().split(/\s+/).length === 24;

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
