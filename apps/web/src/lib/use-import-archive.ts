import { useCallback } from "react";
import { useConvex } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import type { VaultCategory } from "@keeplas/backend/shared_types";
import {
  entryDataStart,
  parseManifest,
  readStoredText,
  readZipEntries,
  type ImportItem,
  type ReadRange,
  type ZipEntry,
} from "@keeplas/export";

import { inferFileKind } from "@/lib/attachment-capture";
import { itemMetaJson } from "@/lib/item-meta";
import { serializeLinks } from "@/lib/link-payload";
import { useUploadQueue } from "@/lib/upload-queue";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useRecipientCrypto } from "@/lib/use-recipient-crypto";
import { useVaultCrypto } from "@/lib/use-vault-crypto";

const CATEGORIES = {
  personal_document: true,
  financial_asset: true,
  digital_asset: true,
  health_directive: true,
  legal_document: true,
  business_continuity: true,
  conditional_message: true,
  credential: true,
  property: true,
  insurance_policy: true,
  subscription: true,
  contacts: true,
  wishes: true,
  other: true,
  inbox: true,
} satisfies Record<VaultCategory, true>;

const isCategory = (value: string): value is VaultCategory =>
  value in CATEGORIES;

export interface ImportProgress {
  done: number;
  total: number;
}

export interface ImportResult {
  imported: number;
  skippedFiles: number;
}

export interface ImportLabels {
  untitled: string;
  folderSuffix: (name: string) => string;
}

export class NotKeeplasArchive extends Error {}

class NeedRange extends Error {
  constructor(
    public offset: number,
    public length: number,
  ) {
    super("range not loaded");
  }
}

function rangeReader(file: Blob) {
  const loaded: { offset: number; bytes: Uint8Array }[] = [];
  const read: ReadRange = (offset, length) => {
    for (const range of loaded) {
      if (
        offset >= range.offset &&
        offset + length <= range.offset + range.bytes.length
      ) {
        return range.bytes.subarray(
          offset - range.offset,
          offset - range.offset + length,
        );
      }
    }
    throw new NeedRange(offset, length);
  };
  return async function run<T>(task: (read: ReadRange) => T): Promise<T> {
    for (let attempt = 0; attempt < 16; attempt++) {
      try {
        return task(read);
      } catch (error) {
        if (!(error instanceof NeedRange)) throw error;
        const end = Math.min(file.size, error.offset + error.length);
        loaded.push({
          offset: error.offset,
          bytes: new Uint8Array(
            await file.slice(error.offset, end).arrayBuffer(),
          ),
        });
      }
    }
    throw new NotKeeplasArchive();
  };
}

export function useImportArchive() {
  const convex = useConvex();
  const createItem = useAuditedMutation(api.vault_items.createItem);
  const createFolder = useAuditedMutation(api.folders.create);
  const { encryptContent, encryptContentWithKey, decryptContent } =
    useVaultCrypto();
  const { generateDekAndWrap } = useRecipientCrypto();
  const { enqueueAttachments } = useUploadQueue();

  return useCallback(
    async (
      archive: File,
      labels: ImportLabels,
      onProgress: (progress: ImportProgress) => void,
    ): Promise<ImportResult> => {
      const run = rangeReader(archive);
      let entries: ZipEntry[];
      let items: ImportItem[];
      try {
        entries = await run((read) => readZipEntries(read, archive.size));
        const manifest = entries.find((entry) => entry.name === "items.json");
        if (!manifest) throw new NotKeeplasArchive();
        items = parseManifest(
          await run((read) => readStoredText(read, manifest)),
        );
      } catch {
        throw new NotKeeplasArchive();
      }
      const byName = new Map(entries.map((entry) => [entry.name, entry]));

      const [vault, folders] = await Promise.all([
        convex.query(api.vaults.getVault, {}),
        convex.query(api.folders.list, {}),
      ]);
      if (!vault) throw new Error("No vault");
      const folderIds = new Map<string, Id<"folders">>();
      const takenNames = new Set<string>();
      for (const folder of folders) {
        const name = await decryptContent(folder.encryptedName).catch(() => "");
        takenNames.add(name);
        if (name && folder.grants.length === 0) folderIds.set(name, folder._id);
      }
      async function folderFor(name: string): Promise<Id<"folders">> {
        const known = folderIds.get(name);
        if (known) return known;
        const finalName = takenNames.has(name)
          ? labels.folderSuffix(name)
          : name;
        const id = (await createFolder({
          encryptedName: await encryptContent(finalName),
        })) as Id<"folders">;
        folderIds.set(name, id);
        takenNames.add(finalName);
        return id;
      }

      let skippedFiles = 0;
      onProgress({ done: 0, total: items.length });
      for (const [index, item] of items.entries()) {
        const { dek, ownerWrap } = await generateDekAndWrap([]);
        const links = item.links.filter((link) => link.trim());
        const itemId = (await createItem({
          vaultId: vault._id,
          encryptedTitle: await encryptContentWithKey(
            item.title || labels.untitled,
            dek,
          ),
          encryptedMeta: await encryptContentWithKey(
            itemMetaJson(isCategory(item.category) ? item.category : "other"),
            dek,
          ),
          encryptedContent: await encryptContentWithKey(item.note, dek),
          encryptedLinks: links.length
            ? await encryptContentWithKey(serializeLinks(links), dek)
            : undefined,
          accessLevel: "private",
          encryptionType: "zero_knowledge",
          ownerWrappedDek: ownerWrap.wrappedDek,
          folderId: item.folder ? await folderFor(item.folder) : undefined,
        })) as Id<"vault_items">;

        const files = [];
        for (const file of item.files) {
          const entry = byName.get(file.path);
          if (!entry || entry.method !== 0) {
            skippedFiles += 1;
            continue;
          }
          const start = await run((read) => entryDataStart(read, entry));
          files.push({
            blob: archive.slice(start, start + entry.size, file.mimeType),
            name: file.name || labels.untitled,
            mimeType: file.mimeType,
            kind: inferFileKind(file.mimeType),
          });
        }
        if (files.length > 0) {
          enqueueAttachments({
            itemId,
            label: item.title || labels.untitled,
            dek,
            files,
          });
        }
        onProgress({ done: index + 1, total: items.length });
      }
      return { imported: items.length, skippedFiles };
    },
    [
      convex,
      createItem,
      createFolder,
      encryptContent,
      encryptContentWithKey,
      decryptContent,
      generateDekAndWrap,
      enqueueAttachments,
    ],
  );
}
