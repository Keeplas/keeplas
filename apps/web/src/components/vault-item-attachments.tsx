"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc, Id } from "@keeplas/backend/_generated/dataModel";
import { Icon, Spinner, cn } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useVaultCrypto } from "@/lib/use-vault-crypto";
import { getErrorMessage } from "@/lib/utils";

type AttachmentFile = Doc<"vault_item_files">;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(totalSec?: number): string | null {
  if (!totalSec || !Number.isFinite(totalSec)) return null;
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  if (m === 0) return `${s}s`;
  return `${m}m${s.toString().padStart(2, "0")}s`;
}

function iconForKind(kind: AttachmentFile["kind"]): string {
  switch (kind) {
    case "audio":
      return ICON_PATHS.mic;
    case "video":
      return ICON_PATHS.videocam;
    case "image":
      return ICON_PATHS.image;
    default:
      return ICON_PATHS.pictureAsPdf;
  }
}

export function VaultItemAttachments({
  itemId,
  itemDek,
}: {
  itemId: Id<"vault_items">;
  // For ZK items, the unwrapped per-item DEK; legacy items leave this undefined
  // and fall back to the master key.
  itemDek?: CryptoKey | null;
}) {
  const files = useQuery(api.vault_items.getItemFiles, { itemId });

  if (files === undefined) {
    return (
      <div className="bg-surface-container-low rounded-2xl p-6 flex items-center gap-3 text-body-md text-on-surface-variant">
        <Spinner size="sm" />
        Loading secure attachments…
      </div>
    );
  }

  if (files.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon path={ICON_PATHS.lock} className="w-4 h-4 text-secondary" />
        <span className="text-label-md text-secondary">
          Secure Attachments · {files.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {files.map((file) => (
          <AttachmentCard key={file._id} file={file} itemDek={itemDek} />
        ))}
      </div>
    </section>
  );
}

function AttachmentCard({
  file,
  itemDek,
}: {
  file: AttachmentFile;
  itemDek?: CryptoKey | null;
}) {
  const signedUrl = useQuery(api.vault_items.getItemFileUrl, {
    fileId: file._id,
  });
  const { decryptBlob, decryptBlobWithKey, isReady } = useVaultCrypto();

  const [plainUrl, setPlainUrl] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    async function run() {
      // ZK items must wait for the unwrapped DEK; legacy items use the master key.
      const dekStillLoading = itemDek === null;
      if (!signedUrl || !isReady || dekStillLoading || plainUrl || decrypting)
        return;
      setDecrypting(true);
      setError("");
      try {
        const res = await fetch(signedUrl);
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        const cipherBlob = await res.blob();
        const plainBlob = itemDek
          ? await decryptBlobWithKey(cipherBlob, file.iv, itemDek)
          : await decryptBlob(cipherBlob, file.iv);
        const typedBlob = new Blob([plainBlob], {
          type: file.mimeType || plainBlob.type || "application/octet-stream",
        });
        createdUrl = URL.createObjectURL(typedBlob);
        if (!cancelled) setPlainUrl(createdUrl);
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, "Unable to decrypt attachment."));
        }
      } finally {
        if (!cancelled) setDecrypting(false);
      }
    }

    run();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedUrl, isReady, itemDek, file._id, file.iv, file.mimeType]);

  const duration = formatDuration(file.durationSec);
  const meta = useMemo(() => {
    const parts: string[] = [formatFileSize(file.size)];
    if (duration) parts.push(duration);
    parts.push("Encrypted");
    return parts.join(" · ");
  }, [file.size, duration]);

  return (
    <article className="bg-surface-container-low rounded-2xl p-5 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              file.kind === "audio" && "bg-secondary/10 text-secondary",
              file.kind === "video" && "bg-primary/10 text-primary",
              file.kind === "image" && "bg-tertiary/10 text-tertiary",
              file.kind === "document" && "bg-surface-container-high text-primary"
            )}
          >
            <Icon path={iconForKind(file.kind)} className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-headline-sm text-primary truncate">
              {file.name}
            </p>
            <p className="text-label-md text-on-surface-variant mt-0.5">{meta}</p>
          </div>
        </div>
        {plainUrl && (
          <a
            href={plainUrl}
            download={file.name}
            className="flex items-center gap-2 text-label-md text-secondary hover:text-primary transition-colors cursor-pointer"
          >
            <Icon path={ICON_PATHS.download} className="w-4 h-4" />
            Download
          </a>
        )}
      </header>

      {decrypting && !plainUrl && (
        <div className="flex items-center gap-2 text-body-md text-on-surface-variant">
          <Spinner size="sm" />
          Decrypting…
        </div>
      )}

      {error && (
        <p className="text-body-md text-error bg-error-container/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {plainUrl && file.kind === "audio" && (
        <audio controls src={plainUrl} className="w-full" />
      )}

      {plainUrl && file.kind === "video" && (
        <video
          controls
          src={plainUrl}
          className="w-full aspect-video rounded-xl bg-primary/5 object-contain"
        />
      )}

      {plainUrl && file.kind === "image" && (
        <div className="overflow-hidden rounded-xl bg-surface-container flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={plainUrl}
            alt={file.name}
            className="max-h-[480px] w-auto object-contain"
          />
        </div>
      )}

      {plainUrl && file.kind === "document" && (
        <div className="flex items-center gap-3 bg-surface rounded-xl px-4 py-3 text-body-md text-on-surface-variant">
          <Icon path={ICON_PATHS.pictureAsPdf} className="w-4 h-4 text-secondary" />
          Document ready — open or download to view.
          <a
            href={plainUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto font-bold text-secondary hover:underline"
          >
            Open
          </a>
        </div>
      )}
    </article>
  );
}
