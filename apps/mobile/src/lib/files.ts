/**
 * File plumbing over expo-file-system: chunked readers / writers for the
 * file cipher (large videos never sit in memory), the outbox folder of
 * ciphertext, ciphertext upload to Convex storage, and decrypted copies for
 * viewing (cache folder, kept until the vault locks).
 */
import { Directory, File, FileMode, Paths, UploadType } from "expo-file-system";

import { decryptFile, type ByteSink, type ByteSource } from "@/crypto/envelope";

export function openSource(uri: string): ByteSource & { close: () => void } {
  const file = new File(uri);
  const handle = file.open(FileMode.ReadOnly);
  return {
    size: handle.size ?? file.size,
    read: (offset, length) => {
      handle.offset = offset;
      return handle.readBytes(length);
    },
    close: () => handle.close(),
  };
}

export function createSink(
  file: File,
): ByteSink & { path: string; close: () => number } {
  if (file.exists) file.delete();
  file.create({ intermediates: true });
  const handle = file.open(FileMode.WriteOnly);
  let written = 0;
  return {
    path: file.uri,
    write: (bytes) => {
      handle.writeBytes(bytes);
      written += bytes.byteLength;
    },
    close: () => {
      handle.close();
      return written;
    },
  };
}

function folder(parent: Directory, name: string): Directory {
  const dir = new Directory(parent, name);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Ciphertext waiting in the outbox (documents folder: survives restarts). */
export const outboxFile = (entryId: string, index: number) =>
  new File(folder(Paths.document, "outbox"), `${entryId}-${index}.bin`);

export function deleteFile(uri: string): void {
  const file = new File(uri);
  if (file.exists) file.delete();
}

/** POST a ciphertext file to a Convex upload URL; returns its storage id. */
export async function uploadFile(
  url: string,
  path: string,
  onProgress: (sent: number) => void,
  contentType = "application/octet-stream",
): Promise<string> {
  const task = new File(path).createUploadTask(url, {
    httpMethod: "POST",
    uploadType: UploadType.BINARY_CONTENT,
    headers: { "Content-Type": contentType },
  });
  const subscription = task.addListener("progress", (p) =>
    onProgress(p.bytesSent),
  );
  try {
    const result = await task.uploadAsync();
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Upload failed (${result.status})`);
    }
    return (JSON.parse(result.body) as { storageId: string }).storageId;
  } finally {
    subscription.remove();
    task.release();
  }
}

/**
 * Download a ciphertext blob and decrypt it into `into` (by default the
 * cache folder cleared on lock) under its real name (for the viewer / share
 * sheet). The caller deletes it after use.
 */
export async function downloadDecrypted(
  url: string,
  iv: string,
  key: CryptoKey,
  name: string,
  onProgress?: (ratio: number) => void,
  into: Directory = folder(Paths.cache, "open"),
  keepAs?: string,
): Promise<File> {
  const cache = into;
  const kept = keepAs ? keptCipher(keepAs) : null;
  let cipher: File;
  if (kept?.exists) {
    cipher = kept;
    onProgress?.(1);
  } else {
    const download = new File(cache, `${Date.now()}.bin`);
    const task = File.createDownloadTask(url, download, {
      onProgress: ({ bytesWritten, totalBytes }) => {
        if (totalBytes > 0) onProgress?.(bytesWritten / totalBytes);
      },
    });
    await task.downloadAsync();
    if (kept) download.move(kept);
    cipher = kept ?? download;
  }
  const safeName = name.replace(/[/\\]/g, "_") || "file";
  const plain = new File(cache, `${Date.now()}-${safeName}`);
  const source = openSource(cipher.uri);
  const sink = createSink(plain);
  let decrypted = false;
  try {
    await decryptFile(source, iv, key, sink);
    decrypted = true;
  } finally {
    source.close();
    sink.close();
    if (!kept || !decrypted) cipher.delete();
  }
  if (kept) trimKeptCiphers();
  return plain;
}

export const KEPT_CIPHER_MAX_BYTES = 500 * 1024 * 1024;

const keptFolder = () => folder(Paths.cache, "cipher");

export function hasKeptCipher(id: string): boolean {
  return keptCipher(id).exists;
}

function keptCipher(id: string): File {
  return new File(keptFolder(), `${id.replace(/[^\w-]/g, "_")}.bin`);
}

export function trimKeptCiphers(maxBytes = KEPT_CIPHER_MAX_BYTES): void {
  const files = keptFolder()
    .list()
    .filter((entry): entry is File => entry instanceof File)
    .map((file) => ({ file, ...file.info() }))
    .sort((a, b) => (b.modificationTime ?? 0) - (a.modificationTime ?? 0));
  let total = 0;
  for (const entry of files) {
    total += entry.size ?? 0;
    if (total > maxBytes) entry.file.delete();
  }
}

export function clearKeptCiphers(): void {
  const dir = new Directory(Paths.cache, "cipher");
  if (dir.exists) dir.delete();
}

const opened = new Map<string, File>();

export function cachedDecrypted(fileId: string): File | null {
  const file = opened.get(fileId);
  if (file?.exists) return file;
  opened.delete(fileId);
  return null;
}

export function rememberDecrypted(fileId: string, file: File): void {
  const previous = opened.get(fileId);
  if (previous && previous.uri !== file.uri && previous.exists)
    previous.delete();
  opened.set(fileId, file);
}

/** Remove every decrypted copy left in the cache (sign-out, lock). */
export function clearDecryptedCache(): void {
  opened.clear();
  const cache = new Directory(Paths.cache, "open");
  if (cache.exists) cache.delete();
}
