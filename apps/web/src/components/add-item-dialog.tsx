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

interface AddItemDialogProps {
  vaultId: Id<"vaults">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: VaultCategory;
}

const ACCEPTED_TYPES = "application/pdf,image/png,image/jpeg";
const MAX_FILE_BYTES = 50 * 1024 * 1024;

interface PreparedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string; // base64
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

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected FileReader result"));
        return;
      }
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export function AddItemDialog({ vaultId, open, onOpenChange, defaultCategory }: AddItemDialogProps) {
  const createItem = useMutation(api.vault_items.createItem);
  const { encryptContent, computeHash, isReady } = useVaultCrypto();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<VaultCategory>(defaultCategory ?? "personal_document");
  const [files, setFiles] = useState<PreparedFile[]>([]);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("private");
  const [tags, setTags] = useState("");
  const [isCritical, setIsCritical] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function ingestFiles(list: FileList | File[]) {
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
      try {
        const data = await readFileAsBase64(file);
        accepted.push({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          data,
        });
      } catch (err) {
        setError(getErrorMessage(err, "Failed to read file."));
      }
    }
    if (accepted.length) {
      setError("");
      setFiles((prev) => [...prev, ...accepted]);
    }
  }

  function handleFilePick(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      void ingestFiles(e.target.files);
      e.target.value = "";
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      void ingestFiles(e.dataTransfer.files);
    }
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
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
    if (files.length === 0) {
      setError("Attach at least one document to secure.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = JSON.stringify({
        version: 1,
        kind: "file_bundle",
        files: files.map(({ id: _id, ...rest }) => rest),
      });
      const encryptedContent = await encryptContent(payload);
      const contentHash = await computeHash(payload);
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
      });

      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save item."));
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="px-8 py-6 items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] text-secondary font-label uppercase tracking-[0.18em]">
              <span>Vault</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
              <span className="text-on-surface-variant/50">Secure New Asset</span>
            </div>
            <DialogTitle className="text-3xl font-black tracking-tighter leading-none">
              Add to Vault
            </DialogTitle>
            <DialogDescription className="max-w-md leading-relaxed">
              Deposit a critical asset. Files are encrypted on your device
              before they leave. AES-256-GCM.
            </DialogDescription>
          </div>
          <DialogClose className="p-2 hover:bg-surface-container-high rounded-xl transition-colors cursor-pointer">
            <svg className="w-5 h-5 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
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
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 7.5m0 0L7.5 12M12 7.5v13.5" />
                </svg>
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

            {files.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-3">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="bg-surface px-3 py-2.5 rounded-xl flex items-center gap-3 max-w-full"
                  >
                    <div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-xs font-bold text-primary truncate max-w-[180px]">
                        {file.name}
                      </p>
                      <p className="text-[10px] text-on-surface-variant">
                        {formatFileSize(file.size)} • Encrypted
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      aria-label={`Remove ${file.name}`}
                      className="ml-1 p-1 rounded-md text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
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
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
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
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-2 text-on-surface-variant hover:text-primary font-headline font-bold text-sm transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Cancel
            </button>
            <Button
              type="submit"
              variant="vault"
              size="lg"
              disabled={saving || !isReady}
              className="gap-3 cursor-pointer"
            >
              <span>{saving ? "Encrypting..." : "Secure Asset to Vault"}</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-1.5 0A2.25 2.25 0 0 0 3.75 12.75v6.75A2.25 2.25 0 0 0 6 21.75h8.25M18 16.5v1.5l1.5 1.5M21.75 19.5a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
              </svg>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
