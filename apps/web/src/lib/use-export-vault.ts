import { useCallback } from "react";
import { useConvex } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
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

import { legacyFileMeta, parseFileMeta, parseItemMeta } from "@/lib/item-meta";
import { parseLinks } from "@/lib/link-payload";
import { useRecipientCrypto } from "@/lib/use-recipient-crypto";
import { useVaultCrypto } from "@/lib/use-vault-crypto";

export interface ExportProgress {
  done: number;
  total: number;
}

export interface ExportLabels {
  untitled: string;
  noFolder: string;
  file: string;
}

export class ExportCancelled extends Error {}

async function crcOf(blob: Blob): Promise<number> {
  const crc = new Crc32();
  const reader = blob.stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return crc.digest();
    crc.update(value);
  }
}

export function useExportVault() {
  const convex = useConvex();
  const {
    decryptContent,
    decryptContentWithKey,
    decryptBlob,
    decryptBlobWithKey,
  } = useVaultCrypto();
  const { unwrapOwnerDek } = useRecipientCrypto();

  return useCallback(
    async (
      labels: ExportLabels,
      onProgress: (progress: ExportProgress) => void,
      cancelled: () => boolean,
    ): Promise<{ archive: Blob; name: string; skipped: number }> => {
      const now = Date.now();
      let skipped = 0;
      const [rawItems, contacts, folders] = await Promise.all([
        convex.query(api.vault_items.getItemSummaries, {}),
        convex.query(api.trusted_contacts.getContacts, {}),
        convex.query(api.folders.list, {}),
      ]);
      const contactName = new Map(
        contacts.map((contact) => [contact._id as string, contact.name]),
      );
      const folderOf = new Map(
        await Promise.all(
          folders.map(
            async (folder) =>
              [
                folder._id as string,
                {
                  name: await decryptContent(folder.encryptedName).catch(
                    () => labels.noFolder,
                  ),
                  people: folder.grants.map((grant) => grant.contactName),
                },
              ] as const,
          ),
        ),
      );

      const opened: (ExportItem & {
        open: (fileIndex: number) => Promise<Blob | null>;
      })[] = [];
      for (const raw of rawItems) {
        if (cancelled()) throw new ExportCancelled();
        const [full, files] = await Promise.all([
          convex.query(api.vault_items.getItem, { itemId: raw._id }),
          convex.query(api.vault_items.getItemFiles, { itemId: raw._id }),
        ]);
        if (!full) continue;
        try {
          const dek = raw.ownerWrappedDek
            ? await unwrapOwnerDek({ wrappedDek: raw.ownerWrappedDek })
            : null;
          const decryptOne = (payload: string) =>
            dek ? decryptContentWithKey(payload, dek) : decryptContent(payload);
          const [title, note, links, meta, metas] = await Promise.all([
            raw.encryptedTitle
              ? decryptOne(raw.encryptedTitle)
              : Promise.resolve(raw.title ?? ""),
            decryptOne(full.encryptedContent),
            full.encryptedLinks
              ? decryptOne(full.encryptedLinks).then(parseLinks)
              : Promise.resolve([] as string[]),
            raw.encryptedMeta
              ? decryptOne(raw.encryptedMeta).then(parseItemMeta)
              : Promise.resolve({ category: raw.category ?? "other" }),
            Promise.all(
              files.map(async (file) =>
                file.encryptedMeta
                  ? parseFileMeta(await decryptOne(file.encryptedMeta))
                  : legacyFileMeta(file),
              ),
            ),
          ]);
          const folder = raw.folderId ? folderOf.get(raw.folderId) : undefined;
          const people = new Set(
            (full.sharedWithContacts ?? [])
              .map((id) => contactName.get(id))
              .filter((name): name is string => Boolean(name)),
          );
          for (const name of folder?.people ?? []) people.add(name);
          opened.push({
            id: raw._id,
            title,
            category: meta.category,
            folder: folder?.name ?? null,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
            note,
            links,
            sharedWith: [...people],
            files: metas.map((file) => ({
              name: file.name,
              mimeType: file.mimeType,
              size: file.size,
            })),
            open: async (fileIndex) => {
              const file = files[fileIndex];
              const url = await convex.query(api.vault_items.getItemFileUrl, {
                fileId: file._id,
              });
              if (!url) return null;
              const response = await fetch(url);
              if (!response.ok)
                throw new Error(`Download failed (${response.status})`);
              const cipher = await response.blob();
              return dek
                ? decryptBlobWithKey(cipher, file.iv, dek)
                : decryptBlob(cipher, file.iv);
            },
          });
        } catch {
          skipped += 1;
        }
      }

      const planned = planExport(opened, labels);
      const total = opened.reduce((sum, item) => sum + item.files.length, 0);
      let done = 0;
      onProgress({ done, total });

      const zip = new ZipBuilder();
      const parts: BlobPart[] = [];
      const encode = (text: string) => new TextEncoder().encode(text);
      const add = (path: string, text: string, when: Date) =>
        parts.push(zip.file(path, encode(text), when));
      const exportContacts: ExportContact[] = contacts.map((contact) => ({
        name: contact.name,
        email: contact.email ?? null,
        phone: contact.phoneNumber ?? null,
        status: contact.invitationStatus,
      }));
      const stamp = new Date(now);
      add("README.txt", readme(now, opened.length), stamp);
      add("items.json", itemsJson(planned, exportContacts, now), stamp);
      add("items.csv", itemsCsv(planned), stamp);
      add("contacts.json", JSON.stringify(exportContacts, null, 2), stamp);

      for (const [index, item] of planned.entries()) {
        const updated = new Date(item.updatedAt);
        if (item.notePath) {
          add(item.notePath, noteDocument(item.title, item.note), updated);
        }
        for (let fileIndex = 0; fileIndex < item.files.length; fileIndex++) {
          if (cancelled()) throw new ExportCancelled();
          const plain = await opened[index].open(fileIndex);
          if (plain) {
            parts.push(
              zip.start(
                item.filePaths[fileIndex],
                plain.size,
                await crcOf(plain),
                updated,
              ),
            );
            parts.push(plain);
            zip.data(plain.size);
            zip.end();
          }
          done += 1;
          onProgress({ done, total });
        }
      }
      parts.push(zip.finish());

      return {
        archive: new Blob(parts, { type: "application/zip" }),
        name: `keeplas-export-${stamp.toISOString().slice(0, 10)}.zip`,
        skipped,
      };
    },
    [
      convex,
      decryptContent,
      decryptContentWithKey,
      decryptBlob,
      decryptBlobWithKey,
      unwrapOwnerDek,
    ],
  );
}
