import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useConvex } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "@keeplas/ui";
import { StateDialog } from "@/components/state-dialog";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import type { StorageRef } from "@keeplas/backend/lib/storage";
import { useAuditedMutation } from "./use-audited-mutation";
import { useVaultCrypto } from "./use-vault-crypto";
import { fileMetaJson } from "./item-meta";
import { useLocale, useTranslations } from "./i18n";
import { formatBytes } from "./format";
import { useRouter } from "./navigation";
import {
  StorageFullMessage,
  UploadFailedMessage,
} from "@/components/upload-state-messages";

type AttachmentKind = "document" | "audio" | "video" | "image";

export interface QueuedFile {
  blob: Blob;
  name: string;
  mimeType: string;
  kind: AttachmentKind;
  durationSec?: number;
}

/** Files to attach to an item that already exists (import, edit). */
export interface EnqueueArgs {
  itemId: Id<"vault_items">;
  label: string;
  dek: CryptoKey;
  files: QueuedFile[];
}

/** An encrypted file in storage, ready for createItem / addItemFiles. */
export interface SealedFile {
  storageId: StorageRef;
  iv: string;
  encryptedMeta: string;
}

/**
 * A new item whose files upload first: `create` runs once every file is in
 * storage, so a cancelled or failed upload leaves no half-made item.
 */
export interface NewItemJob {
  label: string;
  dek: CryptoKey;
  files: QueuedFile[];
  create: (files: SealedFile[]) => Promise<Id<"vault_items">>;
}

/** W06-4 steps: encrypt here, upload the copy, then the item is saved. */
export type JobPhase =
  "encrypting" | "uploading" | "saving" | "done" | "failed" | "cancelled";

export interface JobProgress {
  phase: JobPhase;
  uploaded: number;
  total: number;
  itemId?: Id<"vault_items">;
}

interface UploadQueueContextValue {
  enqueueAttachments: (args: EnqueueArgs) => void;
  /** Starts the job and returns its id for `jobs`, `cancel`, `background`. */
  enqueueNewItem: (job: NewItemJob) => string;
  jobs: Record<string, JobProgress>;
  cancel: (jobId: string) => void;
  /** The screen stops watching: progress moves to a toast. */
  background: (jobId: string) => void;
}

const UploadQueueContext = createContext<UploadQueueContextValue | null>(null);

/**
 * The server refuses an upload past the plan quota with
 * `ConvexError({ code: "STORAGE_QUOTA_EXCEEDED" })`; production redacts plain
 * error messages, so the message check is only a fallback.
 */
function isQuotaError(err: Error): boolean {
  if (err instanceof ConvexError) {
    return (err.data as { code?: string } | null)?.code === QUOTA_CODE;
  }
  return err.message.includes(QUOTA_CODE);
}

const QUOTA_CODE = "STORAGE_QUOTA_EXCEEDED";

/** Section 10 states shown when a job ends with failed files. */
type UploadFailure =
  | { kind: "failed"; name: string; retry: () => void }
  | { kind: "full"; quotaBytes: number; plan: "free" | "lifetime" };

const MAX_CONCURRENT_UPLOADS = 2;
// Radix doesn't honour Infinity here. ~11 days is effectively persistent;
// the toast is dismissed manually on terminal state.
const PERSISTENT_DURATION_MS = 1_000_000_000;
const PROGRESS_THROTTLE_MS = 250;

class CancelledError extends Error {
  constructor() {
    super("Upload cancelled");
  }
}

function uploadWithProgress(
  url: string,
  body: Blob,
  onProgress: (loaded: number) => void,
  signal?: AbortSignal,
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
    xhr.onabort = () => reject(new CancelledError());
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(body);
  });
}

/** Runs `work` over `items` with at most MAX_CONCURRENT_UPLOADS at once. */
async function inSlots<T>(
  items: T[],
  work: (item: T, index: number) => Promise<void>,
) {
  let next = 0;
  const slot = async () => {
    while (next < items.length) {
      const index = next++;
      await work(items[index], index);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_UPLOADS, items.length) },
      slot,
    ),
  );
}

export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("vault.upload");
  const locale = useLocale();
  const convex = useConvex();
  const router = useRouter();
  const [failure, setFailure] = useState<UploadFailure | null>(null);
  const [jobs, setJobs] = useState<Record<string, JobProgress>>({});
  const { encryptBlobWithKey, encryptContentWithKey } = useVaultCrypto();
  const generateUploadUrl = useAuditedMutation(
    api.vault_items.generateUploadUrl,
  );
  const addItemFiles = useAuditedMutation(api.vault_items.addItemFiles);
  const controllers = useRef(new Map<string, AbortController>());
  const toasts = useRef(new Map<string, ReturnType<typeof toast>>());
  const labels = useRef(new Map<string, string>());

  /** Encrypts one file (and its metadata) under the item key. */
  const seal = useCallback(
    async (file: QueuedFile, dek: CryptoKey) => {
      const { cipherBlob, iv } = await encryptBlobWithKey(file.blob, dek);
      const encryptedMeta = await encryptContentWithKey(
        fileMetaJson({
          name: file.name,
          mimeType: file.mimeType,
          size: file.blob.size,
          kind: file.kind,
          durationSec: file.durationSec,
        }),
        dek,
      );
      return { cipherBlob, iv, encryptedMeta };
    },
    [encryptBlobWithKey, encryptContentWithKey],
  );

  const upload = useCallback(
    async (
      cipherBlob: Blob,
      onProgress: (loaded: number) => void,
      signal?: AbortSignal,
    ) =>
      uploadWithProgress(
        await generateUploadUrl(),
        cipherBlob,
        onProgress,
        signal,
      ),
    [generateUploadUrl],
  );

  /** The upload failed: offer a retry, or an upgrade when storage is full. */
  const fail = useCallback(
    async (error: Error, name: string, retry: () => void) => {
      const stats = isQuotaError(error)
        ? await convex.query(api.vaults.getUsageStats, {}).catch(() => null)
        : null;
      setFailure(
        stats
          ? { kind: "full", quotaBytes: stats.quotaBytes, plan: stats.plan }
          : { kind: "failed", name, retry },
      );
    },
    [convex],
  );

  const progressText = useCallback(
    (done: number, total: number) =>
      t("progress", {
        done: formatBytes(done, locale),
        totalBytes: formatBytes(total, locale),
      }),
    [t, locale],
  );

  // Held in refs so retries re-invoke the latest version of each job runner.
  const runAttachRef = useRef<(args: EnqueueArgs) => Promise<void>>(undefined);
  const runNewItemRef =
    useRef<(id: string, job: NewItemJob) => Promise<void>>(undefined);

  const runAttach = useCallback(
    async (args: EnqueueArgs) => {
      const { itemId, label, dek, files } = args;
      const totalBytes = files.reduce((acc, f) => acc + f.blob.size, 0);
      const uploaded = new Array(files.length).fill(0);
      const failed: Array<{ index: number; error: Error }> = [];

      const handle = toast({
        variant: "info",
        title: t(files.length === 1 ? "savingTitle" : "savingTitlePlural", {
          count: files.length,
        }),
        description: t("encrypting", { label }),
        duration: PERSISTENT_DURATION_MS,
      });
      let lastUpdate = 0;
      const refresh = (force = false) => {
        const now = Date.now();
        if (!force && now - lastUpdate < PROGRESS_THROTTLE_MS) return;
        lastUpdate = now;
        handle.update({
          id: handle.id,
          description: progressText(
            uploaded.reduce((a, b) => a + b, 0),
            totalBytes,
          ),
        });
      };

      await inSlots(files, async (file, index) => {
        try {
          const sealed = await seal(file, dek);
          const storageId = await upload(sealed.cipherBlob, (loaded) => {
            uploaded[index] = Math.min(loaded, file.blob.size);
            refresh();
          });
          await addItemFiles({
            itemId,
            files: [
              { storageId, iv: sealed.iv, encryptedMeta: sealed.encryptedMeta },
            ],
          });
          uploaded[index] = file.blob.size;
          refresh(true);
        } catch (err) {
          failed.push({
            index,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      });

      if (failed.length === 0) {
        handle.update({
          id: handle.id,
          variant: "success",
          title: t("savedTitle"),
          description: t(
            files.length === 1 ? "savedDescription" : "savedDescriptionPlural",
            { label, count: files.length },
          ),
          duration: 5000,
        });
        setTimeout(() => handle.dismiss(), 5000);
        return;
      }
      handle.dismiss();
      const retryFiles = failed.map((f) => files[f.index]);
      await fail(
        failed[0].error,
        retryFiles[0].name,
        () => void runAttachRef.current?.({ ...args, files: retryFiles }),
      );
    },
    [seal, upload, addItemFiles, fail, progressText, t],
  );

  const runNewItem = useCallback(
    async (id: string, job: NewItemJob) => {
      const controller = new AbortController();
      controllers.current.set(id, controller);
      labels.current.set(id, job.label);
      // Bytes of ciphertext: known once every file is encrypted.
      let total = job.files.reduce((acc, f) => acc + f.blob.size, 0);
      const uploaded = new Array(job.files.length).fill(0);
      let lastUpdate = 0;
      const report = (phase: JobPhase, extra: Partial<JobProgress> = {}) => {
        const now = Date.now();
        const sent = uploaded.reduce((a, b) => a + b, 0);
        if (phase === "uploading" && now - lastUpdate < PROGRESS_THROTTLE_MS) {
          return;
        }
        lastUpdate = now;
        setJobs((current) => ({
          ...current,
          [id]: { phase, uploaded: sent, total, ...extra },
        }));
        toasts.current.get(id)?.update({
          id: toasts.current.get(id)!.id,
          description: progressText(sent, total),
        });
      };

      try {
        report("encrypting");
        const sealed = await Promise.all(
          job.files.map((file) => seal(file, job.dek)),
        );
        if (controller.signal.aborted) throw new CancelledError();
        total = sealed.reduce((acc, f) => acc + f.cipherBlob.size, 0);
        report("uploading");
        const files: SealedFile[] = new Array(sealed.length);
        await inSlots(sealed, async (file, index) => {
          files[index] = {
            storageId: await upload(
              file.cipherBlob,
              (loaded) => {
                uploaded[index] = Math.min(loaded, file.cipherBlob.size);
                report("uploading");
              },
              controller.signal,
            ),
            iv: file.iv,
            encryptedMeta: file.encryptedMeta,
          };
          uploaded[index] = file.cipherBlob.size;
        });
        if (controller.signal.aborted) throw new CancelledError();
        report("saving");
        const itemId = await job.create(files);
        report("done", { itemId });
        const handle = toasts.current.get(id);
        if (handle) {
          handle.update({
            id: handle.id,
            variant: "success",
            title: t("savedTitle"),
            description: t("savedItem", { label: job.label }),
            duration: 5000,
          });
          setTimeout(() => handle.dismiss(), 5000);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const cancelled = error instanceof CancelledError;
        report(cancelled ? "cancelled" : "failed");
        toasts.current.get(id)?.dismiss();
        if (!cancelled) {
          await fail(error, job.files[0]?.name ?? job.label, () => {
            const retryId = crypto.randomUUID();
            void runNewItemRef.current?.(retryId, job);
          });
        }
      } finally {
        controllers.current.delete(id);
        toasts.current.delete(id);
        labels.current.delete(id);
      }
    },
    [seal, upload, fail, progressText, t],
  );

  useEffect(() => {
    runAttachRef.current = runAttach;
    runNewItemRef.current = runNewItem;
  }, [runAttach, runNewItem]);

  const enqueueAttachments = useCallback(
    (args: EnqueueArgs) => {
      if (args.files.length === 0) return;
      void runAttach(args);
    },
    [runAttach],
  );

  const enqueueNewItem = useCallback(
    (job: NewItemJob) => {
      const id = crypto.randomUUID();
      void runNewItem(id, job);
      return id;
    },
    [runNewItem],
  );

  const cancel = useCallback((jobId: string) => {
    controllers.current.get(jobId)?.abort();
  }, []);

  const background = useCallback(
    (jobId: string) => {
      const job = jobs[jobId];
      if (
        !job ||
        !controllers.current.has(jobId) ||
        toasts.current.has(jobId)
      ) {
        return;
      }
      toasts.current.set(
        jobId,
        toast({
          variant: "info",
          title: t("savingItem", { label: labels.current.get(jobId) ?? "" }),
          description: progressText(job.uploaded, job.total),
          duration: PERSISTENT_DURATION_MS,
        }),
      );
    },
    [jobs, t, progressText],
  );

  const value = useMemo(
    () => ({ enqueueAttachments, enqueueNewItem, jobs, cancel, background }),
    [enqueueAttachments, enqueueNewItem, jobs, cancel, background],
  );

  return (
    <UploadQueueContext.Provider value={value}>
      {children}
      <StateDialog
        open={failure !== null}
        onOpenChange={(open) => !open && setFailure(null)}
        title={
          failure?.kind === "full"
            ? t("state.full.title", {
                quota: formatBytes(failure.quotaBytes, locale),
              })
            : t("state.failed.title")
        }
      >
        {failure?.kind === "failed" ? (
          <UploadFailedMessage
            name={failure.name}
            onRetry={() => {
              setFailure(null);
              failure.retry();
            }}
            onRemove={() => setFailure(null)}
          />
        ) : null}
        {failure?.kind === "full" ? (
          <StorageFullMessage
            quota={formatBytes(failure.quotaBytes, locale)}
            canUpgrade={failure.plan === "free"}
            onUpgrade={() => {
              setFailure(null);
              router.push("/settings/subscription");
            }}
            onManage={() => {
              setFailure(null);
              router.push("/settings");
            }}
          />
        ) : null}
      </StateDialog>
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
