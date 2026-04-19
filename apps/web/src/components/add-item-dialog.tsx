"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { useVaultCrypto } from "@/lib/use-vault-crypto";
import { getErrorMessage } from "@/lib/utils";
import { CATEGORIES, type VaultCategory } from "@/lib/vault-categories";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import type { AccessLevel } from "@keeplas/backend/shared_types";
import {
  Button,
  Icon,
  Input,
  Label,
  Select,
  SelectItem,
  Switch,
  ErrorAlert,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  cn,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { MediaRecorderPanel } from "@/components/media-recorder-panel";

interface AddItemDialogProps {
  vaultId: Id<"vaults">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: VaultCategory;
}

const ACCEPTED_TYPES = "application/pdf,image/png,image/jpeg";
const MAX_FILE_BYTES = 50 * 1024 * 1024;

type FileKind = "document" | "audio" | "video" | "image";

interface PreparedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  kind: FileKind;
  durationSec?: number;
}

const ACCESS_LEVELS: Array<{
  value: AccessLevel;
  label: string;
  description: string;
}> = [
  {
    value: "private",
    label: "Private",
    description: "Only you. Fully sealed under your master key.",
  },
  {
    value: "trusted_only",
    label: "Trusted Contacts",
    description: "Released to approved contacts you've granted access.",
  },
  {
    value: "emergency_only",
    label: "Emergency Only",
    description: "Post-mortem release to your legacy beneficiaries.",
  },
  {
    value: "public",
    label: "Public",
    description: "Visible on the Emergency Card you share.",
  },
];

function SectionHeading({ step, title }: { step: string; title: string }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="w-9 h-9 bg-primary text-on-primary rounded-full flex items-center justify-center font-headline font-bold text-sm shrink-0">
        {step}
      </div>
      <h3 className="text-lg font-bold font-headline tracking-tight text-primary">
        {title}
      </h3>
    </div>
  );
}

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

function inferFileKind(mimeType: string): FileKind {
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  return "document";
}

function iconForKind(kind: FileKind): string {
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

export function AddItemDialog({ vaultId, open, onOpenChange, defaultCategory }: AddItemDialogProps) {
  const createItem = useMutation(api.vault_items.createItem);
  const generateUploadUrl = useMutation(api.vault_items.generateUploadUrl);
  const { encryptContent, encryptBlob, computeHash, isReady } = useVaultCrypto();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<VaultCategory>(defaultCategory ?? "personal_document");
  const [files, setFiles] = useState<PreparedFile[]>([]);
  const [recorderMode, setRecorderMode] = useState<"audio" | "video" | null>(null);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("private");
  const [tags, setTags] = useState("");
  const [isCritical, setIsCritical] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState("");

  function ingestFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    const accepted: PreparedFile[] = [];
    for (const file of incoming) {
      if (!ACCEPTED_TYPES.split(",").includes(file.type)) {
        setError(`${file.name} — unsupported file type. PDF, JPG or PNG only.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`${file.name} — exceeds 50 MB limit.`);
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
      setError("");
      setFiles((prev) => [...prev, ...accepted]);
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
    meta: { mimeType: string; durationSec: number }
  ) {
    if (!recorderMode) return;
    const isVideo = recorderMode === "video";
    const ext = meta.mimeType.includes("mp4") ? "mp4" : "webm";
    const stamp = new Date().toLocaleString();
    setFiles((prev) => [
      ...prev,
      {
        id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: `${isVideo ? "Video" : "Voice"} message — ${stamp}.${ext}`,
        mimeType: meta.mimeType,
        size: blob.size,
        blob,
        kind: isVideo ? "video" : "audio",
        durationSec: meta.durationSec,
      },
    ]);
    setRecorderMode(null);
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function resetDialog() {
    setTitle("");
    setDescription("");
    setCategory(defaultCategory ?? "personal_document");
    setFiles([]);
    setRecorderMode(null);
    setAccessLevel("private");
    setTags("");
    setIsCritical(false);
    setSaving(false);
    setProgress("");
    setError("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetDialog();
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady) {
      setError("Encryption key not available. Please sign in again.");
      return;
    }
    if (!title.trim()) {
      setError("Asset name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const uploadedFiles: Array<{
        storageId: Id<"_storage">;
        name: string;
        mimeType: string;
        size: number;
        iv: string;
        kind: FileKind;
        durationSec?: number;
      }> = [];

      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        setProgress(`Encrypting ${index + 1}/${files.length} — ${file.name}`);
        const { cipherBlob, iv } = await encryptBlob(file.blob);

        setProgress(`Uploading ${index + 1}/${files.length} — ${file.name}`);
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.mimeType || "application/octet-stream" },
          body: cipherBlob,
        });
        if (!res.ok) {
          throw new Error(`Upload failed (${res.status}) for ${file.name}`);
        }
        const { storageId } = (await res.json()) as {
          storageId: Id<"_storage">;
        };

        uploadedFiles.push({
          storageId,
          name: file.name,
          mimeType: file.mimeType,
          size: cipherBlob.size,
          iv,
          kind: file.kind,
          durationSec: file.durationSec,
        });
      }

      setProgress("Sealing vault entry…");
      const textPayload = description.trim();
      const encryptedContent = await encryptContent(textPayload);
      const contentHash = await computeHash(textPayload);
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await createItem({
        vaultId,
        category,
        title: title.trim(),
        description: description.trim() || undefined,
        encryptedContent,
        contentHash,
        accessLevel,
        tags: tagList,
        isCritical,
        files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      });

      handleOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save item."));
      setSaving(false);
      setProgress("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="px-8 py-6 items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-label-md text-secondary">
              <span>Vault</span>
              <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
              <span className="text-on-surface-variant/50">Secure New Asset</span>
            </div>
            <DialogTitle className="text-headline-md">
              Add to Vault
            </DialogTitle>
            <DialogDescription className="text-body-md max-w-md">
              Deposit a critical asset. Files are encrypted on your device
              before they leave. AES-256-GCM.
            </DialogDescription>
          </div>
          <DialogClose className="p-2 hover:bg-surface-container-high rounded-xl transition-colors cursor-pointer">
            <Icon path={ICON_PATHS.close} className="w-5 h-5 text-on-surface-variant" strokeWidth={2} />
          </DialogClose>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-6">
          <ErrorAlert message={error} />

          {/* Section 01 — Asset Identity */}
          <section className="bg-surface-container-low rounded-2xl p-6">
            <SectionHeading step="01" title="Asset Identity" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                  Asset Name
                </Label>
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Primary Brokerage Account"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                  Category
                </Label>
                <Select<VaultCategory>
                  value={category}
                  onValueChange={setCategory}
                  placeholder="Choose a category"
                >
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.key} value={cat.key}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                  Asset Description <span className="text-outline-variant normal-case tracking-normal">(optional)</span>
                </Label>
                <Input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the significance and location of this asset..."
                />
              </div>
            </div>
          </section>

          {/* Section 02 — Secure Documentation */}
          <section className="bg-surface-container-low rounded-2xl p-6">
            <SectionHeading step="02" title="Secure Documentation" />

            {recorderMode ? (
              <MediaRecorderPanel
                mode={recorderMode}
                onRecorded={handleRecorded}
                onCancel={() => setRecorderMode(null)}
              />
            ) : (
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
                    Record audio
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRecorderMode("video")}
                    className="gap-2 cursor-pointer"
                  >
                    <Icon path={ICON_PATHS.videocam} className="w-4 h-4" />
                    Record video
                  </Button>
                  <div className="flex items-center text-[10px] font-label uppercase tracking-[0.15em] text-on-surface-variant/60 ml-auto">
                    or drop a file below
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
                    isDragging && "bg-surface-container-high/80 border-secondary/40"
                  )}
                >
                  <div className="w-14 h-14 bg-surface-container-high rounded-full flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Icon path={ICON_PATHS.download} className="w-7 h-7 rotate-180" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-base font-headline font-bold text-primary">
                      Drag and drop secure files
                    </p>
                    <p className="text-xs text-on-surface-variant font-body mt-1">
                      PDF, JPG, or PNG up to 50 MB per file. Encrypted on arrival.
                    </p>
                  </div>
                  <span className="mt-1 px-5 py-2 bg-surface-container-high text-primary rounded-full font-label font-bold text-[10px] uppercase tracking-[0.18em] hover:bg-surface-container-highest transition-colors">
                    Browse System
                  </span>
                </div>
              </>
            )}

            {files.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-3">
                {files.map((file) => {
                  const duration = formatDuration(file.durationSec);
                  return (
                    <div
                      key={file.id}
                      className="bg-surface px-3 py-2.5 rounded-xl flex items-center gap-3 max-w-full"
                    >
                      <div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                        <Icon path={iconForKind(file.kind)} className="w-4 h-4" />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-xs font-bold text-primary truncate max-w-[200px]">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-on-surface-variant">
                          {formatFileSize(file.size)}
                          {duration ? ` • ${duration}` : ""} • Encrypted
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        aria-label={`Remove ${file.name}`}
                        className="ml-1 p-1 rounded-md text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors cursor-pointer"
                      >
                        <Icon path={ICON_PATHS.close} className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 03 — Transmission Logic */}
          <section className="bg-surface-container-low rounded-2xl p-6">
            <SectionHeading step="03" title="Transmission Logic" />
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                  Access Level
                </Label>
                <Select<AccessLevel>
                  value={accessLevel}
                  onValueChange={setAccessLevel}
                  placeholder="Choose access level"
                  renderValue={(v) => {
                    const level = ACCESS_LEVELS.find((l) => l.value === v);
                    return level ? level.label : "";
                  }}
                >
                  {ACCESS_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      <div className="flex flex-col gap-0.5 py-0.5">
                        <span className="font-semibold">{level.label}</span>
                        <span className="text-[11px] text-on-surface-variant font-normal">
                          {level.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                  Tags <span className="text-outline-variant normal-case tracking-normal">(comma separated)</span>
                </Label>
                <Input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. urgent, family, financial..."
                />
              </div>

              <div className="flex items-start justify-between gap-4 bg-surface rounded-xl p-4 mt-2">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-surface-container-high rounded-full flex items-center justify-center shrink-0 text-primary">
                    <Icon path={ICON_PATHS.warning} className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="font-headline font-bold text-primary text-sm">
                      Mark as critical
                    </p>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed mt-0.5">
                      Critical items are prioritized during emergency access.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isCritical}
                  onCheckedChange={setIsCritical}
                  className="mt-1"
                />
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="flex items-center gap-2 text-on-surface-variant hover:text-primary font-headline font-bold text-sm transition-colors cursor-pointer"
            >
              <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4 rotate-180" strokeWidth={2} />
              Cancel
            </button>
            <div className="flex items-center gap-4">
              {progress && (
                <span className="text-[11px] text-on-surface-variant font-label uppercase tracking-[0.12em]">
                  {progress}
                </span>
              )}
              <Button
                type="submit"
                variant="vault"
                size="lg"
                disabled={saving || !isReady}
                className="gap-3 cursor-pointer"
              >
                <span>{saving ? "Sealing…" : "Secure Asset to Vault"}</span>
                <Icon path={ICON_PATHS.lock} className="w-5 h-5" strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
