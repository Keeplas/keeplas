import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvex, useQueries, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { unwrapBytes } from "@keeplas/crypto/kem";
import { toast } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";
import { formatBytes } from "@/lib/format";
import { parseFileMeta, type FileMeta } from "@/lib/item-meta";
import { useRecipientCrypto } from "@/lib/use-recipient-crypto";
import { useVaultCrypto } from "@/lib/use-vault-crypto";
import type { SharedFile, SharedFolder } from "./shared-with-me-view";

type FolderGrant = Id<"folder_grants">;

interface OpenedItem {
  file: SharedFile;
  dek: CryptoKey;
  attachment: { id: Id<"vault_item_files">; iv: string; meta: FileMeta } | null;
}

/** "PDF · 1.2 MB": extension (or MIME subtype) and the sealed exact size. */
function fileDetail(meta: FileMeta): string {
  const extension = meta.name.includes(".")
    ? meta.name.split(".").pop()!
    : (meta.mimeType.split("/").pop() ?? "");
  return `${extension.toUpperCase()} · ${formatBytes(meta.size)}`;
}

/**
 * Folders other people shared with me (W04-4), opened on this device: the
 * folder name is sealed to my ML-KEM key, each item DEK is wrapped to it, and
 * titles / file metadata are sealed under the item DEK. Returns undefined
 * while loading, plus `download` for the "more" menu.
 */
export function useSharedFolders() {
  const t = useTranslations("sharedWithMe.folders");
  const convex = useConvex();
  const grants = useQuery(api.folders.sharedWithMe);
  const { ensureOwnerKeypair, unwrapOwnerDek, isReady } = useRecipientCrypto();
  const { decryptContentWithKey, decryptBlobWithKey } = useVaultCrypto();
  const [names, setNames] = useState<Record<string, string>>({});
  const [items, setItems] = useState<Record<string, OpenedItem[]>>({});
  const opened = useRef(new Map<string, OpenedItem>());

  const requests = useMemo(
    () =>
      Object.fromEntries(
        (grants ?? [])
          .filter((grant) => grant.available)
          .map((grant) => [
            grant.grantId,
            {
              query: api.folders.getSharedFolder,
              args: { grantId: grant.grantId },
            },
          ]),
      ),
    [grants],
  );
  const contents = useQueries(requests);

  useEffect(() => {
    if (!grants || !isReady) return;
    let cancelled = false;
    (async () => {
      const { secretKey } = await ensureOwnerKeypair();
      const next: Record<string, string> = {};
      for (const grant of grants) {
        try {
          next[grant.grantId] = new TextDecoder().decode(
            await unwrapBytes(grant.sealedName, secretKey),
          );
        } catch {
          next[grant.grantId] = "";
        }
      }
      if (!cancelled) setNames(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [grants, isReady, ensureOwnerKeypair]);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, OpenedItem[]> = {};
      for (const [grantId, folder] of Object.entries(contents)) {
        if (!folder || folder instanceof Error) continue;
        next[grantId] = [];
        for (const item of folder.items) {
          if (!item.wrappedDek) continue;
          try {
            const dek = await unwrapOwnerDek({ wrappedDek: item.wrappedDek });
            const first = item.files[0];
            const meta = first?.encryptedMeta
              ? parseFileMeta(
                  await decryptContentWithKey(first.encryptedMeta, dek),
                )
              : null;
            const entry: OpenedItem = {
              dek,
              file: {
                id: item._id,
                title: item.encryptedTitle
                  ? await decryptContentWithKey(item.encryptedTitle, dek)
                  : (meta?.name ?? ""),
                detail: meta ? fileDetail(meta) : "",
                updatedAt: item.updatedAt,
              },
              attachment:
                first && meta ? { id: first._id, iv: first.iv, meta } : null,
            };
            opened.current.set(`${grantId}/${item._id}`, entry);
            next[grantId].push(entry);
          } catch {
            // A wrap this device cannot open stays hidden.
          }
        }
      }
      if (!cancelled) setItems(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [contents, isReady, unwrapOwnerDek, decryptContentWithKey]);

  const download = useCallback(
    async (grantId: string, itemId: string) => {
      const entry = opened.current.get(`${grantId}/${itemId}`);
      if (!entry?.attachment) return;
      try {
        const url = await convex.query(api.folders.getSharedFileUrl, {
          grantId: grantId as FolderGrant,
          fileId: entry.attachment.id,
        });
        if (!url) throw new Error("File unavailable");
        const cipher = await (await fetch(url)).blob();
        const plain = await decryptBlobWithKey(
          cipher,
          entry.attachment.iv,
          entry.dek,
        );
        const link = document.createElement("a");
        link.href = URL.createObjectURL(
          new Blob([plain], { type: entry.attachment.meta.mimeType }),
        );
        link.download = entry.attachment.meta.name;
        link.click();
        // Revoking right away can cancel the download in some browsers.
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      } catch {
        toast({ variant: "error", title: t("downloadFailed") });
      }
    },
    [convex, decryptBlobWithKey, t],
  );

  const folders: SharedFolder[] | undefined = grants?.map((grant) => ({
    id: grant.grantId,
    name: names[grant.grantId] ?? "",
    ownerName: grant.ownerName,
    available: grant.available,
    files: (items[grant.grantId] ?? []).map((entry) => entry.file),
  }));

  return { folders, download };
}
