"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { useQuery } from "convex/react";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { api } from "@keeplas/backend/_generated/api";
import { useVaultCrypto } from "@/lib/use-vault-crypto";
import { useRecipientCrypto } from "@/lib/use-recipient-crypto";
import { getErrorMessage } from "@/lib/utils";
import { CATEGORIES, type VaultCategory } from "@/lib/vault-categories";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import type { AccessLevel } from "@keeplas/backend/shared_types";
import Link from "next/link";
import {
  Button,
  DatePicker,
  Icon,
  InfoCallout,
  Input,
  Label,
  RichTextEditor,
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
// AccessLevel is now derived from recipient selection + isPublic switch
// instead of being chosen directly. Mapping:
//   isPublic on              → "public"
//   no recipients selected   → "private"
//   recipients selected      → "trusted_only"
// "emergency_only" was redundant with "trusted_only" (both released at trigger)
// and has been collapsed into "trusted_only".
import { ICON_PATHS } from "@/lib/icons";
import { MediaRecorderPanel } from "@/components/media-recorder-panel";
import { MultiSelect, type MultiSelectOption } from "@/components/multi-select";
import { VaultLinkInputList } from "@/components/vault-link-input-list";
import { serializeLinks, isValidUrl } from "@/lib/link-payload";
import { useUploadQueue } from "@/lib/upload-queue";

const GROUP_PREFIX = "group:";
const CONTACT_PREFIX = "contact:";

type RecipientMode = "default" | "groups" | "explicit";

type TriggerType = "life_check_failure" | "time_based" | "manual";

interface TriggerOption {
  value: TriggerType;
  label: string;
  hint: string;
}

const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    value: "life_check_failure",
    label: "Verified Life-Check Failure",
    hint: "Released when you stop responding to Life Checks for the configured number of days.",
  },
  {
    value: "time_based",
    label: "Time-based Release",
    hint: "Released on a specific calendar date — useful for birthdays, anniversaries, or coming-of-age letters.",
  },
  {
    value: "manual",
    label: "Manual Trigger",
    hint: "Released only when you (or a curator) explicitly approve from the dashboard.",
  },
];

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

function SectionHeading({ step, title }: { step: string; title: string }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="w-9 h-9 bg-primary text-on-primary rounded-full flex items-center justify-center text-body-md font-bold shrink-0">
        {step}
      </div>
      <h3 className="text-headline-sm text-primary">
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
  const createItem = useAuditedMutation(api.vault_items.createItem);
  const {
    encryptContentWithKey,
    computeHash,
    isReady,
  } = useVaultCrypto();
  const { generateDekAndWrap, isReady: cryptoReady } = useRecipientCrypto();
  const { enqueueAttachments } = useUploadQueue();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const recipientGroupsRaw = useQuery(api.recipient_groups.listGroups);
  const allContactsRaw = useQuery(api.trusted_contacts.getContacts);
  const recipientGroups = useMemo(() => recipientGroupsRaw ?? [], [recipientGroupsRaw]);
  const allContacts = useMemo(() => allContactsRaw ?? [], [allContactsRaw]);

  const [title, setTitle] = useState("");
  // Holds the rich-text body. Always encrypted into `encryptedContent` before
  // upload — never sent to the server in plaintext (zero-knowledge).
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<VaultCategory>(defaultCategory ?? "personal_document");
  const [files, setFiles] = useState<PreparedFile[]>([]);
  const [linkUrls, setLinkUrls] = useState<string[]>([""]);
  const [recorderMode, setRecorderMode] = useState<"audio" | "video" | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [recipientSelection, setRecipientSelection] = useState<string[]>([]);
  const [recipientsTouched, setRecipientsTouched] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [triggerType, setTriggerType] = useState<TriggerType>("life_check_failure");
  const [releaseDate, setReleaseDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState("");

  const isLetter = category === "conditional_message";

  // Pre-select the user's default group on first open of the dialog so
  // most items go to "all trust contacts" without any picking. The user
  // can then narrow down or clear to make the item private.
  useEffect(() => {
    if (!open || recipientsTouched) return;
    if (recipientGroups.length === 0) return;
    const defaultGroup = recipientGroups.find((g) => g.isDefault);
    if (defaultGroup) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-fills selection from async query data once per open; the `recipientsTouched` guard keeps the override-then-edit semantics simple.
      setRecipientSelection([`${GROUP_PREFIX}${defaultGroup._id}`]);
    }
  }, [open, recipientGroups, recipientsTouched]);

  // Sync category with the caller-provided default each time the dialog
  // opens, so callers (e.g. "Add Digital Asset" CTA) can land the user
  // directly in the right category without manual picking.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets category to caller-provided default on each (re)open; a `key`-based remount would lose all draft state.
      setCategory(defaultCategory ?? "personal_document");
    }
  }, [open, defaultCategory]);

  const recipientOptions = useMemo<MultiSelectOption[]>(() => {
    const groupOpts: MultiSelectOption[] = recipientGroups.map((g) => ({
      value: `${GROUP_PREFIX}${g._id}`,
      label: g.name,
      hint:
        g.memberContactIds.length === 1
          ? "1 contact"
          : `${g.memberContactIds.length} contacts`,
      groupLabel: "Groups",
    }));
    const contactOpts: MultiSelectOption[] = allContacts.map((c) => ({
      value: `${CONTACT_PREFIX}${c._id}`,
      label: c.name,
      hint: c.email,
      groupLabel: "Individual contacts",
    }));
    return [...groupOpts, ...contactOpts];
  }, [recipientGroups, allContacts]);

  function resolveRecipientConfig(): {
    mode: RecipientMode;
    sharedWithGroups: Id<"recipient_groups">[];
    sharedWithContacts: Id<"trusted_contacts">[];
    derivedAccessLevel: AccessLevel;
  } {
    const groupIds = recipientSelection
      .filter((v) => v.startsWith(GROUP_PREFIX))
      .map((v) => v.slice(GROUP_PREFIX.length) as Id<"recipient_groups">);
    const contactIds = recipientSelection
      .filter((v) => v.startsWith(CONTACT_PREFIX))
      .map((v) => v.slice(CONTACT_PREFIX.length) as Id<"trusted_contacts">);

    if (isPublic) {
      // Items on the emergency card go to "public" regardless of which
      // groups are picked. We still record the recipient config so the
      // owner can also release the item to specific people at trigger.
    }

    if (groupIds.length === 0 && contactIds.length === 0) {
      // Empty selection = private. Mode "default" means "all trust contacts"
      // in the resolver, but private items are skipped at release time so
      // this never fires distribution.
      return {
        mode: "default",
        sharedWithGroups: [],
        sharedWithContacts: [],
        derivedAccessLevel: isPublic ? "public" : "private",
      };
    }

    if (contactIds.length > 0 && groupIds.length === 0) {
      return {
        mode: "explicit",
        sharedWithGroups: [],
        sharedWithContacts: contactIds,
        derivedAccessLevel: isPublic ? "public" : "trusted_only",
      };
    }

    return {
      mode: "groups",
      sharedWithGroups: groupIds,
      sharedWithContacts: contactIds,
      derivedAccessLevel: isPublic ? "public" : "trusted_only",
    };
  }

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
    // Filesystem-safe timestamp: YYYY-MM-DD_HH-mm-ss (local time).
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
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
    setBody("");
    setCategory(defaultCategory ?? "personal_document");
    setFiles([]);
    setLinkUrls([""]);
    setRecorderMode(null);
    setIsPublic(false);
    setRecipientSelection([]);
    setRecipientsTouched(false);
    setTriggerType("life_check_failure");
    setReleaseDate("");
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
    if (!isReady || !cryptoReady) {
      setError("Encryption key not available. Please sign in again.");
      return;
    }
    if (!title.trim()) {
      setError("Asset name is required.");
      return;
    }

    const cleanUrls = linkUrls.map((u) => u.trim()).filter(Boolean);
    const invalidUrl = cleanUrls.find((u) => !isValidUrl(u));
    if (invalidUrl) {
      setError(`Invalid URL: ${invalidUrl}`);
      return;
    }

    if (isLetter && triggerType === "time_based" && !releaseDate) {
      setError("Pick a release date for the time-based trigger.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const recipientConfig = resolveRecipientConfig();

      let resolvedRecipients: Array<{
        contactId: string;
        contactPublicKey?: string;
      }> = [];
      if (recipientConfig.mode === "explicit") {
        const byId = new Map(allContacts.map((c) => [c._id, c]));
        resolvedRecipients = recipientConfig.sharedWithContacts
          .map((id) => byId.get(id))
          .filter((c): c is NonNullable<typeof c> => Boolean(c))
          .map((c) => ({
            contactId: c._id,
            contactPublicKey: c.contactPublicKey,
          }));
      } else if (recipientConfig.mode === "groups") {
        const byId = new Map(allContacts.map((c) => [c._id, c]));
        const groupSet = new Set(recipientConfig.sharedWithGroups);
        const memberSet = new Set<string>();
        for (const g of recipientGroups) {
          if (!groupSet.has(g._id)) continue;
          for (const cid of g.memberContactIds) memberSet.add(cid);
        }
        resolvedRecipients = Array.from(memberSet)
          .map((id) => byId.get(id as Id<"trusted_contacts">))
          .filter((c): c is NonNullable<typeof c> => Boolean(c))
          .map((c) => ({
            contactId: c._id,
            contactPublicKey: c.contactPublicKey,
          }));
      } else {
        // mode "default" — empty selection. The item is private (no
        // recipients) so we don't need any wrapped DEKs beyond the owner's.
        resolvedRecipients = [];
      }

      setProgress("Generating per-item key…");
      const { dek, ownerWrap, recipientWraps, skippedRecipientIds } =
        await generateDekAndWrap(resolvedRecipients);

      setProgress("Sealing vault entry…");
      const textPayload = body.trim();
      const encryptedContent = await encryptContentWithKey(textPayload, dek);
      const contentHash = await computeHash(textPayload);
      const encryptedLinks =
        cleanUrls.length > 0
          ? await encryptContentWithKey(serializeLinks(cleanUrls), dek)
          : undefined;

      const triggerArgs = isLetter
        ? {
            triggerType,
            triggerConfig:
              triggerType === "time_based" && releaseDate
                ? { releaseDate: new Date(releaseDate).getTime() }
                : undefined,
          }
        : {};

      // Create the item without attachments first, then hand the files to
      // the background upload queue so the dialog can close immediately.
      // The vault page subscribes reactively and shows attachments as the
      // queue calls addItemFiles for each completed upload.
      const itemId = (await createItem({
        vaultId,
        category,
        title: title.trim(),
        encryptedContent,
        encryptedLinks,
        contentHash,
        accessLevel: recipientConfig.derivedAccessLevel,
        encryptionType: "zero_knowledge",
        ownerWrappedDek: ownerWrap.wrappedDek,
        recipientMode: recipientConfig.mode,
        sharedWithGroups: recipientConfig.sharedWithGroups,
        sharedWithContacts: recipientConfig.sharedWithContacts,
        recipientKeys: recipientWraps.map((rw) => ({
          contactId: rw.contactId as Id<"trusted_contacts">,
          wrappedDek: rw.wrappedDek,
        })),
        files: undefined,
        ...triggerArgs,
      })) as Id<"vault_items">;

      if (files.length > 0) {
        enqueueAttachments({
          itemId,
          label: title.trim(),
          dek,
          files: files.map((f) => ({
            blob: f.blob,
            name: f.name,
            mimeType: f.mimeType,
            kind: f.kind,
            durationSec: f.durationSec,
          })),
        });
      }

      if (skippedRecipientIds.length > 0) {
        const skippedCount = skippedRecipientIds.length;
        setProgress(
          `Sealed. ${skippedCount} recipient${skippedCount === 1 ? "" : "s"} won't receive this item until they accept their invitation.`
        );
      }

      handleOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save item."));
      setSaving(false);
      setProgress("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-8 py-6 items-start shrink-0 static">
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
        <form
          onSubmit={handleSubmit}
          className="px-8 pb-8 pt-6 space-y-6 flex-1 overflow-y-auto min-h-0"
        >
          <ErrorAlert message={error} />

          {/* Section 01 — Asset Identity */}
          <section className="bg-surface-container-low rounded-2xl p-6">
            <SectionHeading step="01" title="Asset Identity" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-label-md text-on-surface-variant">
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
                <Label className="text-label-md text-on-surface-variant">
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
                <Label className="text-label-md text-on-surface-variant">
                  {isLetter ? "Message" : "Asset Description"}{" "}
                  {!isLetter && (
                    <span className="text-outline-variant normal-case tracking-normal">
                      (optional)
                    </span>
                  )}
                </Label>
                <RichTextEditor
                  value={body}
                  onChange={setBody}
                  placeholder={
                    isLetter
                      ? "Write the message that will be released…"
                      : "Describe the significance and location of this asset…"
                  }
                  minHeight={isLetter ? 240 : 160}
                />
              </div>

              {isLetter && (
                <div className="md:col-span-2 space-y-2">
                  <Label className="text-label-md text-on-surface-variant">
                    Trigger
                  </Label>
                  <Select<TriggerType>
                    value={triggerType}
                    onValueChange={setTriggerType}
                    placeholder="Choose a trigger"
                  >
                    {TRIGGER_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        label={opt.label}
                        description={opt.hint}
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              )}

              {isLetter && triggerType === "time_based" && (
                <div className="md:col-span-2 space-y-2">
                  <Label className="text-label-md text-on-surface-variant">
                    Release on
                  </Label>
                  <DatePicker
                    value={releaseDate}
                    onChange={setReleaseDate}
                    min={new Date().toISOString().split("T")[0]}
                    placeholder="Pick a release date"
                  />
                </div>
              )}

              {isLetter && triggerType === "life_check_failure" && (
                <div className="md:col-span-2">
                  <InfoCallout icon={ICON_PATHS.heartbeat}>
                    Uses your global Life Check cadence and escalation. Adjust
                    the inactivity threshold once in{" "}
                    <Link
                      href="/life-check"
                      className="text-secondary font-semibold hover:underline"
                    >
                      Life Check settings
                    </Link>
                    — it applies to every letter with this trigger.
                  </InfoCallout>
                </div>
              )}
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
                  <div className="flex items-center text-label-md text-on-surface-variant/60 ml-auto">
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
                    <p className="text-headline-sm text-primary">
                      Drag and drop secure files
                    </p>
                    <p className="text-body-md text-on-surface-variant mt-1">
                      PDF, JPG, or PNG up to 50 MB per file. Encrypted on arrival.
                    </p>
                  </div>
                  <span className="mt-1 px-5 py-2 bg-surface-container-high text-primary rounded-full text-label-md hover:bg-surface-container-highest transition-colors">
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
                        <p className="text-body-md font-bold text-primary truncate max-w-[200px]">
                          {file.name}
                        </p>
                        <p className="text-label-md text-on-surface-variant">
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

          {/* Section 03 — Linked URLs */}
          <section className="bg-surface-container-low rounded-2xl p-6">
            <SectionHeading step="03" title="Linked URLs" />
            <VaultLinkInputList urls={linkUrls} onChange={setLinkUrls} />
          </section>

          {/* Section 04 — Transmission Logic */}
          <section className="bg-surface-container-low rounded-2xl p-6">
            <SectionHeading step="04" title="Transmission Logic" />
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-label-md text-on-surface-variant">
                  Who receives this at trigger?
                </Label>
                <MultiSelect
                  options={recipientOptions}
                  selected={recipientSelection}
                  onChange={(next) => {
                    setRecipientsTouched(true);
                    setRecipientSelection(next);
                  }}
                  placeholder="No one — keep private"
                  searchPlaceholder="Search groups or contacts…"
                  emptyMessage="No groups or contacts yet."
                  renderTrigger={(selected) => {
                    if (selected.length === 0) {
                      return (
                        <span className="text-outline-variant">
                          No one — keep private
                        </span>
                      );
                    }
                    const labels = selected
                      .map(
                        (v) =>
                          recipientOptions.find((o) => o.value === v)?.label
                      )
                      .filter(Boolean);
                    return (
                      <span className="truncate">{labels.join(", ")}</span>
                    );
                  }}
                />
                <p className="text-label-md text-on-surface-variant/70">
                  Pick one or more groups (your trust contacts are already a
                  group), or specific people. Empty = the item stays private.
                </p>
              </div>

              <div className="flex items-start justify-between gap-4 bg-surface rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-surface-container-high rounded-full flex items-center justify-center shrink-0 text-primary">
                    <Icon path={ICON_PATHS.emergencyCard} className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-headline-sm text-primary">
                      Show on Emergency Card
                    </p>
                    <p className="text-body-md text-on-surface-variant mt-0.5">
                      Anyone scanning your QR card will see this item.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
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
              className="flex items-center gap-2 text-on-surface-variant hover:text-primary text-body-md font-bold transition-colors cursor-pointer"
            >
              <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4 rotate-180" strokeWidth={2} />
              Cancel
            </button>
            <div className="flex items-center gap-4">
              {progress && (
                <span className="text-label-md text-on-surface-variant">
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
