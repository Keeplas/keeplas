import { useCallback } from "react";
import { Directory, File, Paths } from "expo-file-system";
import { api } from "@keeplas/backend/_generated/api";
import {
  entryDataStart,
  parseManifest,
  readStoredText,
  readZipEntries,
  type ImportItem,
  type ZipEntry,
} from "@keeplas/export";

import { encryptText } from "@/crypto/envelope";
import { fileKindOf, type VaultCategory } from "@/crypto/item-meta";
import type { CaptureFile } from "@/features/capture/seal";
import { useOutbox } from "@/features/outbox/outbox-provider";
import { useVaultData } from "@/features/vault/vault-data";
import { createSink, openSource } from "@/lib/files";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useVault } from "@/providers/vault-provider";

const CHUNK = 1024 * 1024;

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

export class NotKeeplasArchive extends Error {}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function noteWithLinks(item: ImportItem, label: string): string {
  if (!item.links.length) return item.note;
  const list = item.links
    .map((link) => `<li>${escapeHtml(link)}</li>`)
    .join("");
  return `${item.note}<p>${escapeHtml(label)}</p><ul>${list}</ul>`;
}

export function useImportArchive() {
  const { t } = useI18n();
  const { capture } = useOutbox();
  const { folders } = useVaultData();
  const { masterKey } = useVault();
  const createFolder = useAuditedMutation(api.folders.create);

  return useCallback(
    async (
      archiveUri: string,
      onProgress: (progress: ImportProgress) => void,
    ): Promise<ImportResult> => {
      if (!masterKey) throw new Error("Vault is locked");
      const source = openSource(archiveUri);
      const work = new Directory(Paths.cache, "import");
      try {
        if (!work.exists) work.create({ intermediates: true });
        let entries: ZipEntry[];
        try {
          entries = readZipEntries(source.read, source.size);
        } catch {
          throw new NotKeeplasArchive();
        }
        const byName = new Map(entries.map((entry) => [entry.name, entry]));
        const manifest = byName.get("items.json");
        if (!manifest) throw new NotKeeplasArchive();
        let items: ImportItem[];
        try {
          items = parseManifest(readStoredText(source.read, manifest));
        } catch {
          throw new NotKeeplasArchive();
        }

        const folderIds = new Map<string, string>();
        for (const folder of folders ?? []) {
          if (folder.name && folder.grants.length === 0) {
            folderIds.set(folder.name, folder.id);
          }
        }
        const takenNames = new Set(
          (folders ?? []).map((folder) => folder.name ?? ""),
        );
        async function folderFor(name: string): Promise<string> {
          const known = folderIds.get(name);
          if (known) return known;
          const finalName = takenNames.has(name)
            ? t("importArchive.folderSuffix", { name })
            : name;
          const id = (await createFolder({
            encryptedName: await encryptText(finalName, masterKey!),
          })) as string;
          folderIds.set(name, id);
          takenNames.add(finalName);
          return id;
        }

        let skippedFiles = 0;
        onProgress({ done: 0, total: items.length });
        for (const [index, item] of items.entries()) {
          const extracted: CaptureFile[] = [];
          try {
            for (const [position, file] of item.files.entries()) {
              const entry = byName.get(file.path);
              if (!entry || entry.method !== 0) {
                skippedFiles += 1;
                continue;
              }
              const target = new File(work, `${index}-${position}.bin`);
              const sink = createSink(target);
              try {
                const start = entryDataStart(source.read, entry);
                for (let at = 0; at < entry.size; at += CHUNK) {
                  sink.write(
                    source.read(start + at, Math.min(CHUNK, entry.size - at)),
                  );
                }
              } finally {
                sink.close();
              }
              extracted.push({
                uri: target.uri,
                name: file.name || t("export.file"),
                mimeType: file.mimeType,
                kind: fileKindOf(file.mimeType),
              });
            }
            await capture({
              title: item.title || t("capture.untitled"),
              note: noteWithLinks(item, t("importArchive.links")),
              category: isCategory(item.category) ? item.category : "other",
              files: extracted,
              folderId: item.folder ? await folderFor(item.folder) : undefined,
            });
          } finally {
            for (const file of extracted) {
              const copy = new File(file.uri);
              if (copy.exists) copy.delete();
            }
          }
          onProgress({ done: index + 1, total: items.length });
        }
        return { imported: items.length, skippedFiles };
      } finally {
        source.close();
        if (work.exists) work.delete();
      }
    },
    [capture, folders, masterKey, createFolder, t],
  );
}
