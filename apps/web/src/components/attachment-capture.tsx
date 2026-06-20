import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Button, Icon, cn } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { MediaRecorderPanel } from "@/components/media-recorder-panel";
import {
  ACCEPTED_TYPES,
  MAX_FILE_BYTES,
  inferFileKind,
  type PreparedFile,
} from "@/lib/attachment-capture";

interface AttachmentCaptureProps {
  /** Emits newly captured files (recorded or picked) to the parent. */
  onAdd: (files: PreparedFile[]) => void;
  /** Surfaces validation errors so the parent can show them in its own alert. */
  onError?: (message: string) => void;
}

/**
 * Capture controls shared by the vault create dialog and edit page: record an
 * audio/video message via {@link MediaRecorderPanel}, or drag-and-drop / browse
 * for files. Validates type + size, then hands `PreparedFile`s to `onAdd`. The
 * parent owns the resulting file list rendering (chips vs. rows differ).
 */
export function AttachmentCapture({ onAdd, onError }: AttachmentCaptureProps) {
  const t = useTranslations("vault");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recorderMode, setRecorderMode] = useState<
    "audio" | "video" | "screen" | null
  >(null);
  const [isDragging, setIsDragging] = useState(false);
  // Screen capture is desktop-only — most mobile browsers lack getDisplayMedia.
  const canRecordScreen =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getDisplayMedia;

  function ingestFiles(list: FileList | File[]) {
    const accepted: PreparedFile[] = [];
    for (const file of Array.from(list)) {
      if (!ACCEPTED_TYPES.split(",").includes(file.type)) {
        onError?.(t("editor.errorUnsupportedType", { name: file.name }));
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        onError?.(t("editor.errorTooLarge", { name: file.name }));
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        blob: file,
        kind: inferFileKind(file.type),
      });
    }
    if (accepted.length) {
      onError?.("");
      onAdd(accepted);
    }
  }

  function handleFilePick(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      ingestFiles(e.target.files);
      e.target.value = "";
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      ingestFiles(e.dataTransfer.files);
    }
  }

  function handleRecorded(
    blob: Blob,
    meta: { mimeType: string; durationSec: number },
  ) {
    if (!recorderMode) return;
    const isVideoLike = recorderMode === "video" || recorderMode === "screen";
    const ext = meta.mimeType.includes("mp4") ? "mp4" : "webm";
    // Filesystem-safe timestamp: YYYY-MM-DD_HH-mm-ss (local time).
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    onAdd([
      {
        id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: `${
          recorderMode === "screen"
            ? t("recorder.screenMessage")
            : recorderMode === "video"
              ? t("recorder.videoMessage")
              : t("recorder.voiceMessage")
        } — ${stamp}.${ext}`,
        mimeType: meta.mimeType,
        size: blob.size,
        blob,
        kind: isVideoLike ? "video" : "audio",
        durationSec: meta.durationSec,
      },
    ]);
    setRecorderMode(null);
  }

  if (recorderMode) {
    return (
      <MediaRecorderPanel
        mode={recorderMode}
        onRecorded={handleRecorded}
        onCancel={() => setRecorderMode(null)}
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRecorderMode("audio")}
          className="gap-2 cursor-pointer"
        >
          <Icon path={ICON_PATHS.mic} className="w-4 h-4" />
          {t("dialog.recordAudio")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRecorderMode("video")}
          className="gap-2 cursor-pointer"
        >
          <Icon path={ICON_PATHS.videocam} className="w-4 h-4" />
          {t("dialog.recordVideo")}
        </Button>
        {canRecordScreen && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRecorderMode("screen")}
            className="gap-2 cursor-pointer"
          >
            <Icon path={ICON_PATHS.screen} className="w-4 h-4" />
            {t("dialog.recordScreen")}
          </Button>
        )}
        <div className="flex items-center text-label-md text-on-surface-variant/60 ml-auto">
          {t("dialog.orDropFile")}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        onChange={handleFilePick}
        className="sr-only"
      />

      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed border-outline-variant/30 rounded-2xl p-10 text-center flex flex-col items-center gap-4 transition-colors group cursor-pointer",
          "hover:bg-surface-container-high/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40",
          isDragging && "bg-surface-container-high/80 border-secondary/40",
        )}
      >
        <div className="w-14 h-14 bg-surface-container-high rounded-full flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
          <Icon
            path={ICON_PATHS.download}
            className="w-7 h-7 rotate-180"
            strokeWidth={1.75}
          />
        </div>
        <div>
          <p className="text-headline-sm text-primary">
            {t("dialog.dropTitle")}
          </p>
          <p className="text-body-md text-on-surface-variant mt-1">
            {t("dialog.dropHint")}
          </p>
        </div>
        <span className="mt-1 px-5 py-2 bg-surface-container-high text-primary rounded-full text-label-md hover:bg-surface-container-highest transition-colors">
          {t("dialog.browseSystem")}
        </span>
      </div>
    </>
  );
}
