import { ICON_PATHS } from "@/lib/icons";

// Shared types + helpers for the vault attachment capture flow (record audio /
// video + upload), used by both the create dialog and the edit page so the two
// stay in sync. Pure module — no JSX, no React.

export const ACCEPTED_TYPES = "application/pdf,image/png,image/jpeg";
/** "up to 100 MB each" (W06-3); the plan quota still applies server-side. */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

/** What an "Add" entry picks: documents (PDF, Word, images), photos, videos. */
export type CaptureKind = "document" | "photo" | "video";

const WORD =
  ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const ACCEPT: Record<CaptureKind | "any", string> = {
  document: `.pdf,application/pdf,${WORD},image/*`,
  photo: "image/*",
  video: "video/*",
  // Upload files and drag and drop (W06-1).
  any: `.pdf,application/pdf,${WORD},image/*,video/*,audio/*`,
};

/** Whether `file` matches an `accept` list (extensions, MIME, `type/*`). */
export function acceptsFile(
  file: { name: string; type: string },
  accept: string,
): boolean {
  const name = file.name.toLowerCase();
  return accept.split(",").some((token) => {
    if (token.startsWith(".")) return name.endsWith(token);
    if (token.endsWith("/*")) return file.type.startsWith(token.slice(0, -1));
    return file.type === token;
  });
}

/** The dialog a set of files opens: photos or videos alone, else documents. */
export function captureKindOf(files: { type: string }[]): CaptureKind {
  if (files.length > 0 && files.every((f) => f.type.startsWith("image/"))) {
    return "photo";
  }
  if (files.length > 0 && files.every((f) => f.type.startsWith("video/"))) {
    return "video";
  }
  return "document";
}

export type FileKind = "document" | "audio" | "video" | "image";

export interface PreparedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  kind: FileKind;
  durationSec?: number;
}

export function inferFileKind(mimeType: string): FileKind {
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  return "document";
}

export function iconForKind(kind: FileKind): string {
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

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(totalSec?: number): string | null {
  if (!totalSec || !Number.isFinite(totalSec)) return null;
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  if (m === 0) return `${s}s`;
  return `${m}m${s.toString().padStart(2, "0")}s`;
}
