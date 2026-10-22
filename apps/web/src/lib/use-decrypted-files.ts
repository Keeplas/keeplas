import { useEffect, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { useVaultCrypto } from "./use-vault-crypto";
import type { OpenedFile } from "./use-opened-files";

export type DecryptedFile =
  { status: "ready"; url: string; blob: Blob } | { status: "error" };

/**
 * The owner's attachments decrypted in this browser, on demand: each file in
 * `wanted` is downloaded (ciphertext), decrypted with the item key and kept
 * as a blob URL until the item changes or the screen unmounts. A missing
 * entry means still decrypting.
 */
export function useDecryptedFiles(
  files: OpenedFile[] | undefined,
  wanted: Id<"vault_item_files">[],
  key: CryptoKey | undefined,
  /** Legacy item: files are sealed under the master key. */
  legacy: boolean,
): Map<string, DecryptedFile> {
  const convex = useConvex();
  const { decryptBlob, decryptBlobWithKey } = useVaultCrypto();
  const [decrypted, setDecrypted] = useState(
    () => new Map<string, DecryptedFile>(),
  );
  const started = useRef(new Set<string>());
  const urls = useRef<string[]>([]);
  // Bumped when the key changes or the screen unmounts: a download that
  // finishes afterwards is stale, and its plaintext is freed at once.
  const generation = useRef(0);

  // A new key (another item) starts over.
  useEffect(
    () => () => {
      generation.current += 1;
      urls.current.forEach((url) => URL.revokeObjectURL(url));
      urls.current = [];
      started.current = new Set();
      setDecrypted(new Map());
    },
    [key],
  );

  const wantedKey = wanted.join(",");
  useEffect(() => {
    if (!files || !key) return;
    for (const id of wantedKey.split(",").filter(Boolean)) {
      const file = files.find((candidate) => candidate._id === id);
      if (!file || started.current.has(id)) continue;
      started.current.add(id);
      const run = generation.current;
      void (async () => {
        let entry: DecryptedFile;
        try {
          const signed = await convex.query(api.vault_items.getItemFileUrl, {
            fileId: file._id,
          });
          if (!signed) throw new Error("File unavailable");
          const response = await fetch(signed);
          if (!response.ok)
            throw new Error(`Download failed (${response.status})`);
          const cipher = await response.blob();
          const plain = legacy
            ? await decryptBlob(cipher, file.iv)
            : await decryptBlobWithKey(cipher, file.iv, key);
          if (run !== generation.current) return;
          const blob = new Blob([plain], { type: file.mimeType });
          const url = URL.createObjectURL(blob);
          urls.current.push(url);
          entry = { status: "ready", url, blob };
        } catch {
          entry = { status: "error" };
        }
        if (run === generation.current) {
          setDecrypted((current) => new Map(current).set(id, entry));
        }
      })();
    }
  }, [files, wantedKey, key, legacy, convex, decryptBlob, decryptBlobWithKey]);

  return decrypted;
}
