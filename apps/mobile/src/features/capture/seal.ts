/**
 * "Encrypting on device" (M07-4 step 1): turn a capture into ciphertext
 * ready for the outbox, exactly as the web add-item dialog does
 * (apps/web/src/components/add-item-dialog.tsx + upload-queue.tsx):
 *
 *   DEK            fresh AES-256-GCM key, ML-KEM-wrapped to the owner
 *   encryptedTitle / encryptedContent / encryptedMeta {v:1, category}
 *   each file      encryptFile(DEK) + encryptedMeta {v:1, name, mimeType,
 *                  size, kind, durationSec?}
 *
 * The DEK never leaves this function: once sealed, the entry can be
 * uploaded later (offline) without the vault being unlocked.
 */
import { wrapDek } from "@keeplas/crypto/kem";

import {
  encryptFile,
  encryptText,
  generateDek,
  type ByteSink,
  type ByteSource,
} from "@/crypto/envelope";
import {
  fileMetaJson,
  INBOX,
  itemMetaJson,
  type FileKind,
  type VaultCategory,
} from "@/crypto/item-meta";
import type { OutboxFile, SealedItem } from "@/features/outbox/outbox";

export interface CaptureFile {
  uri: string;
  name: string;
  mimeType: string;
  kind: FileKind;
  durationSec?: number;
}

export interface CaptureDraft {
  title: string;
  note: string;
  files: CaptureFile[];
  category?: VaultCategory;
  icon?: string;
}

export interface SealIO {
  open: (uri: string) => ByteSource & { close: () => void };
  /** A new ciphertext file for attachment `index` of entry `entryId`. */
  create: (
    entryId: string,
    index: number,
  ) => ByteSink & { path: string; close: () => number };
}

export async function sealCapture(
  entryId: string,
  draft: CaptureDraft,
  ownerPublicKey: string,
  io: SealIO,
): Promise<{ item: SealedItem; files: OutboxFile[] }> {
  const dek = await generateDek();
  const item: SealedItem = {
    ownerWrappedDek: await wrapDek(dek, ownerPublicKey),
    encryptedTitle: await encryptText(draft.title.trim(), dek),
    encryptedMeta: await encryptText(
      itemMetaJson(draft.category ?? INBOX, draft.icon),
      dek,
    ),
    encryptedContent: await encryptText(draft.note.trim(), dek),
  };
  const files: OutboxFile[] = [];
  for (const [index, file] of draft.files.entries()) {
    const source = io.open(file.uri);
    const sink = io.create(entryId, index);
    let iv: string;
    let size: number;
    try {
      size = source.size;
      iv = await encryptFile(source, sink, dek);
    } finally {
      source.close();
    }
    const bytes = sink.close();
    files.push({
      path: sink.path,
      iv,
      bytes,
      encryptedMeta: await encryptText(
        fileMetaJson({
          name: file.name,
          mimeType: file.mimeType,
          size,
          kind: file.kind,
          durationSec: file.durationSec,
        }),
        dek,
      ),
    });
  }
  return { item, files };
}
