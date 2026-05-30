"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { toast, ToastAction } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import type { StorageRef } from "@keeplas/backend/lib/storage";
import { useAuditedMutation } from "./use-audited-mutation";
import { useVaultCrypto } from "./use-vault-crypto";
import { useTranslations } from "./i18n";

type AttachmentKind = "document" | "audio" | "video" | "image";

export interface QueuedFile {
  blob: Blob;
  name: string;
  mimeType: string;
  kind: AttachmentKind;
  durationSec?: number;
}

export interface EnqueueArgs {
  itemId: Id<"vault_items">;
  label: string;
  dek: CryptoKey;
  files: QueuedFile[];
}

interface UploadQueueContextValue {
  enqueueAttachments: (args: EnqueueArgs) => void;
}

const UploadQueueContext = createContext<UploadQueueContextValue | null>(null);

const MAX_CONCURRENT_UPLOADS = 2;
// Radix doesn't honour Infinity here. ~11 days is effectively persistent;
// the toast is dismissed manually on terminal state.
const PERSISTENT_DURATION_MS = 1_000_000_000;
const TOAST_THROTTLE_MS = 250;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadWithProgress(
  url: string,
  body: Blob,
  onProgress: (loaded: number) => void,
): Promise<StorageRef> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText) as {
            storageId: StorageRef;
          };
          resolve(parsed.storageId);
        } catch (err) {
          reject(
            err instanceof Error ? err : new Error("Malformed upload response"),
          );
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload aborted"));
    xhr.send(body);
  });
}

export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("vault.upload");
  const { encryptBlobWithKey } = useVaultCrypto();
  const generateUploadUrl = useAuditedMutation(
    api.vault_items.generateUploadUrl,
  );
  const addItemFiles = useAuditedMutation(api.vault_items.addItemFiles);

  // Held in a ref so the retry action can re-invoke the latest `runJob`
  // without `runJob` referencing itself before it is declared.
  const runJobRef = useRef<(args: EnqueueArgs) => Promise<void>>(undefined);

  const runJob = useCallback(
    async (args: EnqueueArgs) => {
      const { itemId, label, dek, files } = args;
      const totalBytes = files.reduce((acc, f) => acc + f.blob.size, 0);
      const fileBytesUploaded = new Array(files.length).fill(0);
      let completed = 0;
      const failed: Array<{ index: number; error: Error }> = [];

      const handle = toast({
        variant: "info",
        title: t(files.length === 1 ? "savingTitle" : "savingTitlePlural", {
          count: files.length,
        }),
        description: t("encrypting", { label }),
        duration: PERSISTENT_DURATION_MS,
      });

      let lastToastUpdate = 0;
      const refreshToast = (force = false) => {
        const now = Date.now();
        if (!force && now - lastToastUpdate < TOAST_THROTTLE_MS) return;
        lastToastUpdate = now;
        const done = fileBytesUploaded.reduce((a, b) => a + b, 0);
        handle.update({
          id: handle.id,
          description: t("progress", {
            label,
            completed,
            total: files.length,
            done: formatBytes(done),
            totalBytes: formatBytes(totalBytes),
          }),
        });
      };

      let nextIndex = 0;
      const runSlot = async () => {
        while (true) {
          const i = nextIndex++;
          if (i >= files.length) return;
          const file = files[i];
          try {
            const { cipherBlob, iv } = await encryptBlobWithKey(file.blob, dek);
            const url = await generateUploadUrl();
            const storageId = await uploadWithProgress(
              url,
              cipherBlob,
              (loaded) => {
                fileBytesUploaded[i] = Math.min(loaded, file.blob.size);
                refreshToast();
              },
            );
            await addItemFiles({
              itemId,
              files: [
                {
                  storageId,
                  name: file.name,
                  mimeType: file.mimeType,
                  size: cipherBlob.size,
                  iv,
                  kind: file.kind,
                  durationSec: file.durationSec,
                },
              ],
            });
            fileBytesUploaded[i] = file.blob.size;
            completed += 1;
            refreshToast(true);
          } catch (err) {
            failed.push({
              index: i,
              error: err instanceof Error ? err : new Error(String(err)),
            });
          }
        }
      };

      const slotCount = Math.min(MAX_CONCURRENT_UPLOADS, files.length);
      await Promise.all(Array.from({ length: slotCount }, () => runSlot()));

      if (failed.length === 0) {
        handle.update({
          id: handle.id,
          variant: "success",
          title: t("savedTitle"),
          description: t(
            completed === 1 ? "savedDescription" : "savedDescriptionPlural",
            { label, count: completed },
          ),
          duration: 5000,
        });
        // Let the success state breathe before auto-dismiss.
        setTimeout(() => handle.dismiss(), 5000);
      } else {
        const retryFiles = failed.map((f) => files[f.index]);
        const firstError = failed[0].error.message;
        handle.update({
          id: handle.id,
          variant: "error",
          title: t("failedTitle"),
          description: t("failedDescription", {
            label,
            completed,
            total: files.length,
            failed: failed.length,
            error: firstError,
          }),
          duration: PERSISTENT_DURATION_MS,
          action: (
            <ToastAction
              altText={t("retryAltText")}
              onClick={() => {
                handle.dismiss();
                void runJobRef.current?.({
                  itemId,
                  label,
                  dek,
                  files: retryFiles,
                });
              }}
            >
              {t("retry")}
            </ToastAction>
          ),
        });
      }
    },
    [encryptBlobWithKey, generateUploadUrl, addItemFiles, t],
  );

  useEffect(() => {
    runJobRef.current = runJob;
  }, [runJob]);

  const enqueueAttachments = useCallback(
    (args: EnqueueArgs) => {
      if (args.files.length === 0) return;
      void runJob(args);
    },
    [runJob],
  );

  const value = useMemo(() => ({ enqueueAttachments }), [enqueueAttachments]);

  return (
    <UploadQueueContext.Provider value={value}>
      {children}
    </UploadQueueContext.Provider>
  );
}

export function useUploadQueue(): UploadQueueContextValue {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) {
    throw new Error(
      "useUploadQueue must be used inside <UploadQueueProvider>.",
    );
  }
  return ctx;
}
