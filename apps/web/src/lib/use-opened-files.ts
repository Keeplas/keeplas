import { useEffect, useState } from "react";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import { useVaultCrypto } from "./use-vault-crypto";
import { legacyFileMeta, parseFileMeta, type FileMeta } from "./item-meta";

/** A file row with its metadata opened (F4): name, type, size, kind. */
export type OpenedFile = Omit<
  Doc<"vault_item_files">,
  "name" | "mimeType" | "size" | "kind" | "durationSec"
> &
  Omit<FileMeta, "v">;

/**
 * Open each file's `encryptedMeta` with the item key: the unwrapped DEK for
 * zero-knowledge items, the master key for legacy items (`itemDek`
 * undefined). `itemDek === null` means the DEK is still loading. Returns
 * undefined until every row is open; legacy rows use their plaintext columns.
 */
export function useOpenedFiles(
  files: Doc<"vault_item_files">[] | undefined,
  itemDek: CryptoKey | null | undefined,
): OpenedFile[] | undefined {
  const { decryptContent, decryptContentWithKey, isReady } = useVaultCrypto();
  const [opened, setOpened] = useState<OpenedFile[] | undefined>(undefined);

  useEffect(() => {
    if (!files || itemDek === null || (!itemDek && !isReady)) return;
    let cancelled = false;
    (async () => {
      const next = await Promise.all(
        files.map(async (file): Promise<OpenedFile> => {
          let meta: FileMeta = legacyFileMeta(file);
          if (file.encryptedMeta) {
            try {
              meta = parseFileMeta(
                itemDek
                  ? await decryptContentWithKey(file.encryptedMeta, itemDek)
                  : await decryptContent(file.encryptedMeta),
              );
            } catch {
              // Unreadable metadata: keep the neutral legacy defaults.
            }
          }
          const { v: _v, ...fields } = meta;
          return { ...file, ...fields };
        }),
      );
      if (!cancelled) setOpened(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [files, itemDek, isReady, decryptContent, decryptContentWithKey]);

  return opened;
}
