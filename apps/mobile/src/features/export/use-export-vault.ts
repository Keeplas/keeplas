import { useCallback } from "react";
import { useConvex } from "convex/react";
import { Directory, File, Paths } from "expo-file-system";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  Crc32,
  itemsCsv,
  itemsJson,
  noteDocument,
  planExport,
  readme,
  ZipBuilder,
  type ExportContact,
  type ExportItem,
} from "@keeplas/export";

import { decryptText } from "@/crypto/envelope";
import {
  legacyFileMeta,
  parseFileMeta,
  parseItemMeta,
  type FileMeta,
} from "@/crypto/item-meta";
import { useVaultData } from "@/features/vault/vault-data";
import { createSink, downloadDecrypted, openSource } from "@/lib/files";
import { useI18n } from "@/providers/i18n-provider";

const CHUNK = 1024 * 1024;

export interface ExportProgress {
  done: number;
  total: number;
}

export class ExportCancelled extends Error {}

function parseLinks(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((link): link is string => typeof link === "string")
      : [];
  } catch {
    return [];
  }
}

export function useExportVault() {
  const convex = useConvex();
  const { t } = useI18n();
  const { itemKey, folders } = useVaultData();

  return useCallback(
    async (
      onProgress: (progress: ExportProgress) => void,
      cancelled: () => boolean,
    ): Promise<{ archive: File; skipped: number }> => {
      const now = Date.now();
      let skipped = 0;
      const [rawItems, contacts] = await Promise.all([
        convex.query(api.vault_items.getItemSummaries, {}),
        convex.query(api.trusted_contacts.getContacts, {}),
      ]);
      const contactName = new Map(
        contacts.map((contact) => [contact._id as string, contact.name]),
      );
      const folderOf = new Map(
        (folders ?? []).map((folder) => [folder.id as string, folder]),
      );

      const opened: (ExportItem & {
        sources: { id: Id<"vault_item_files">; iv: string; meta: FileMeta }[];
        key: CryptoKey;
      })[] = [];
      for (const raw of rawItems) {
        if (cancelled()) throw new ExportCancelled();
        const key = await itemKey(raw);
        const [full, files] = await Promise.all([
          convex.query(api.vault_items.getItem, { itemId: raw._id }),
          convex.query(api.vault_items.getItemFiles, { itemId: raw._id }),
        ]);
        if (!full) continue;
        const decrypted = await Promise.all([
          raw.encryptedTitle
            ? decryptText(raw.encryptedTitle, key)
            : Promise.resolve(raw.title ?? ""),
          decryptText(full.encryptedContent, key),
          full.encryptedLinks
            ? decryptText(full.encryptedLinks, key).then(parseLinks)
            : Promise.resolve([]),
          raw.encryptedMeta
            ? decryptText(raw.encryptedMeta, key).then(parseItemMeta)
            : Promise.resolve({
                v: 1 as const,
                category: raw.category ?? "other",
              }),
          Promise.all(
            files.map(async (file) => ({
              id: file._id,
              iv: file.iv,
              meta: file.encryptedMeta
                ? parseFileMeta(await decryptText(file.encryptedMeta, key))
                : legacyFileMeta(file),
            })),
          ),
        ]).catch(() => null);
        if (!decrypted) {
          skipped += 1;
          continue;
        }
        const [title, note, links, meta, sources] = decrypted;
        const folder = raw.folderId ? folderOf.get(raw.folderId) : undefined;
        const people = new Set(
          (full.sharedWithContacts ?? [])
            .map((id) => contactName.get(id))
            .filter((name): name is string => Boolean(name)),
        );
        for (const grant of folder?.grants ?? []) people.add(grant.contactName);
        opened.push({
          id: raw._id,
          title,
          category: meta.category,
          folder: folder ? (folder.name ?? t("folders.title")) : null,
          createdAt: raw.createdAt,
          updatedAt: raw.updatedAt,
          note,
          links,
          sharedWith: [...people],
          files: sources.map(({ meta: file }) => ({
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
          })),
          sources,
          key,
        });
      }

      const planned = planExport(opened, {
        untitled: t("capture.untitled"),
        noFolder: t("folders.noFolder"),
        file: t("export.file"),
      });
      const total = opened.reduce((sum, item) => sum + item.sources.length, 0);
      let done = 0;
      onProgress({ done, total });

      const dir = new Directory(Paths.cache, "open");
      if (!dir.exists) dir.create({ intermediates: true });
      const day = new Date(now).toISOString().slice(0, 10);
      const archive = new File(dir, `keeplas-export-${day}.zip`);
      const sink = createSink(archive);
      const zip = new ZipBuilder();
      const encode = (text: string) => new TextEncoder().encode(text);
      const exportContacts: ExportContact[] = contacts.map((contact) => ({
        name: contact.name,
        email: contact.email ?? null,
        phone: contact.phoneNumber ?? null,
        status: contact.invitationStatus,
      }));

      try {
        const stamp = new Date(now);
        sink.write(
          zip.file("README.txt", encode(readme(now, opened.length)), stamp),
        );
        sink.write(
          zip.file(
            "items.json",
            encode(itemsJson(planned, exportContacts, now)),
            stamp,
          ),
        );
        sink.write(zip.file("items.csv", encode(itemsCsv(planned)), stamp));
        sink.write(
          zip.file(
            "contacts.json",
            encode(JSON.stringify(exportContacts, null, 2)),
            stamp,
          ),
        );

        for (const [index, item] of planned.entries()) {
          const updated = new Date(item.updatedAt);
          if (item.notePath) {
            sink.write(
              zip.file(
                item.notePath,
                encode(noteDocument(item.title, item.note)),
                updated,
              ),
            );
          }
          const { sources, key } = opened[index];
          for (const [position, source] of sources.entries()) {
            if (cancelled()) throw new ExportCancelled();
            const url = await convex.query(api.vault_items.getItemFileUrl, {
              fileId: source.id,
            });
            if (url) {
              const plain = await downloadDecrypted(
                url,
                source.iv,
                key,
                source.meta.name,
              );
              try {
                const reader = openSource(plain.uri);
                try {
                  const crc = new Crc32();
                  for (let at = 0; at < reader.size; at += CHUNK) {
                    crc.update(
                      reader.read(at, Math.min(CHUNK, reader.size - at)),
                    );
                  }
                  sink.write(
                    zip.start(
                      item.filePaths[position],
                      reader.size,
                      crc.digest(),
                      updated,
                    ),
                  );
                  for (let at = 0; at < reader.size; at += CHUNK) {
                    const bytes = reader.read(
                      at,
                      Math.min(CHUNK, reader.size - at),
                    );
                    sink.write(bytes);
                    zip.data(bytes.length);
                  }
                  zip.end();
                } finally {
                  reader.close();
                }
              } finally {
                if (plain.exists) plain.delete();
              }
            }
            done += 1;
            onProgress({ done, total });
          }
        }
        sink.write(zip.finish());
        sink.close();
        return { archive, skipped };
      } catch (error) {
        sink.close();
        if (archive.exists) archive.delete();
        throw error;
      }
    },
    [convex, itemKey, folders, t],
  );
}
