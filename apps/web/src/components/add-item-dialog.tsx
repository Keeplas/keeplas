import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ChangeEvent,
} from "react";
import { useQuery } from "convex/react";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { api } from "@keeplas/backend/_generated/api";
import { useVaultCrypto } from "@/lib/use-vault-crypto";
import {
  useRecipientCrypto,
  type WrapRecipient,
} from "@/lib/use-recipient-crypto";
import { toWrapRecipient } from "@/lib/verify-contact-key";
import { useBlockedWrapAlert } from "@/lib/use-blocked-wrap-alert";
import { getErrorMessage } from "@/lib/utils";
import { CATEGORIES, type VaultCategory } from "@/lib/vault-categories";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import type { AccessLevel } from "@keeplas/backend/shared_types";
import { Link } from "@/lib/navigation";
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
  ErrorAlert,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  cn,
} from "@keeplas/ui";
// AccessLevel is derived from recipient selection:
//   no recipients selected   → "private"
//   recipients selected      → "trusted_only"
import { ICON_PATHS } from "@/lib/icons";
import { MediaRecorderPanel } from "@/components/media-recorder-panel";
import { MultiSelect, type MultiSelectOption } from "@/components/multi-select";
import { VaultLinkInputList } from "@/components/vault-link-input-list";
import { serializeLinks, isValidUrl } from "@/lib/link-payload";
import { useUploadQueue } from "@/lib/upload-queue";
import { useTranslations } from "@/lib/i18n";

const GROUP_PREFIX = "group:";
const CONTACT_PREFIX = "contact:";
// Sentinel for the "All trust contacts" pseudo-option surfaced in intro mode.
// Selecting it stores the item as recipientMode="default" (the resolver expands
// to every accepted trust contact at release time) while still triggering a
// per-recipient DEK wrap for the current trust contacts so they can decrypt.
const ALL_TRUSTED_VALUE = "all-trusted";

type RecipientMode = "default" | "groups" | "explicit";

type TriggerType = "life_check_failure" | "time_based" | "manual";

interface TriggerOption {
  value: TriggerType;
  // Stable i18n key suffix; label/hint resolve via t("triggers.<key>.*").
  key: string;
}

const TRIGGER_OPTIONS: TriggerOption[] = [
  { value: "life_check_failure", key: "lifeCheck" },
  { value: "time_based", key: "timeBased" },
  { value: "manual", key: "manual" },
];

type AddItemDialogMode = "vault" | "release_introduction";

interface AddItemDialogProps {
  vaultId: Id<"vaults">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: VaultCategory;
  /**
   * "release_introduction" repurposes the dialog to author the welcome
   * message shown to trusted contacts on the memorial page after release.
   * Category / trigger fields are hidden, the item is flagged
   * isReleaseIntroduction=true, and recipients default to "everyone".
   */
  mode?: AddItemDialogMode;
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
      <h3 className="text-headline-sm text-primary">{title}</h3>
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

export function AddItemDialog({
  vaultId,
  open,
  onOpenChange,
  defaultCategory,
  mode = "vault",
}: AddItemDialogProps) {
  const t = useTranslations("vault");
  const isIntroMode = mode === "release_introduction";
  const createItem = useAuditedMutation(api.vault_items.createItem);
  const { encryptContentWithKey, isReady } = useVaultCrypto();
  const { generateDekAndWrap, isReady: cryptoReady } = useRecipientCrypto();
  const showBlockedWrapAlert = useBlockedWrapAlert();
  const { enqueueAttachments } = useUploadQueue();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const recipientGroupsRaw = useQuery(api.recipient_groups.listGroups);
  const allContactsRaw = useQuery(api.trusted_contacts.getContacts);
  const recipientGroups = useMemo(
    () => recipientGroupsRaw ?? [],
    [recipientGroupsRaw],
  );
  const allContacts = useMemo(() => allContactsRaw ?? [], [allContactsRaw]);

  const [title, setTitle] = useState("");
  // Holds the rich-text body. Always encrypted into `encryptedContent` before
  // upload — never sent to the server in plaintext (zero-knowledge).
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<VaultCategory>(
    isIntroMode
      ? "conditional_message"
      : (defaultCategory ?? "personal_document"),
  );
  const [files, setFiles] = useState<PreparedFile[]>([]);
  const [linkUrls, setLinkUrls] = useState<string[]>([""]);
  const [recorderMode, setRecorderMode] = useState<"audio" | "video" | null>(
    null,
  );
  const [recipientSelection, setRecipientSelection] = useState<string[]>([]);
  const [recipientsTouched, setRecipientsTouched] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [triggerType, setTriggerType] =
    useState<TriggerType>("life_check_failure");
  const [releaseDate, setReleaseDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState("");

  const isLetter = category === "conditional_message";

  // Pre-select the user's default group on first open of the dialog so
  // most items go to "all trust contacts" without any picking. The user
  // can then narrow down or clear to make the item private. Intro mode
  // skips the group altogether and pre-selects the explicit "All trust
  // contacts" pseudo-option — that way an owner with no recipient groups
  // (or who deleted the default one) still gets a sane default.
  useEffect(() => {
    if (!open || recipientsTouched) return;
    if (isIntroMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-fills selection on dialog open; guarded by `recipientsTouched`.
      setRecipientSelection([ALL_TRUSTED_VALUE]);
      return;
    }
    if (recipientGroups.length === 0) return;
    const defaultGroup = recipientGroups.find((g) => g.isDefault);
    if (defaultGroup) {
      setRecipientSelection([`${GROUP_PREFIX}${defaultGroup._id}`]);
    }
  }, [open, recipientGroups, recipientsTouched, isIntroMode]);

  // Sync category with the caller-provided default each time the dialog
  // opens, so callers (e.g. "Add Digital Asset" CTA) can land the user
  // directly in the right category without manual picking. Intro mode
  // forces "conditional_message" regardless of defaults — the field is
  // hidden in that mode and the category is semantically meaningless.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets category to caller-provided default on each (re)open; a `key`-based remount would lose all draft state.
      setCategory(
        isIntroMode
          ? "conditional_message"
          : (defaultCategory ?? "personal_document"),
      );
    }
  }, [open, defaultCategory, isIntroMode]);

  const recipientOptions = useMemo<MultiSelectOption[]>(() => {
    const allTrustedOpt: MultiSelectOption[] = isIntroMode
      ? [
          {
            value: ALL_TRUSTED_VALUE,
            label: t("recipients.allContacts"),
            hint: t("recipients.allContactsHint"),
            groupLabel: t("recipients.broadcastLabel"),
          },
        ]
      : [];
    // Count only members that still resolve to a live (non-revoked) contact —
    // `allContacts` is already filtered to non-revoked. A revoked contact lingers
    // in `memberContactIds` (revoke doesn't prune groups), so the raw array
    // length would over-count vs. both the individual list and what actually
    // gets released (resolveItemRecipients intersects the same way).
    const liveContactIds = new Set(allContacts.map((c) => c._id));
    const groupOpts: MultiSelectOption[] = recipientGroups.map((g) => {
      const memberCount = g.memberContactIds.filter((id) =>
        liveContactIds.has(id),
      ).length;
      return {
        value: `${GROUP_PREFIX}${g._id}`,
        label: g.name,
        hint:
          memberCount === 1
            ? t("recipients.contactCountOne", { count: 1 })
            : t("recipients.contactCountOther", { count: memberCount }),
        groupLabel: t("recipients.groupsLabel"),
      };
    });
    const contactOpts: MultiSelectOption[] = allContacts.map((c) => ({
      value: `${CONTACT_PREFIX}${c._id}`,
      label: c.name,
      hint: c.email,
      groupLabel: t("recipients.individualsLabel"),
    }));
    return [...allTrustedOpt, ...groupOpts, ...contactOpts];
  }, [isIntroMode, recipientGroups, allContacts, t]);

  // Mutual exclusivity for the "All trust contacts" sentinel: picking it clears
  // any specific group/contact selections, and picking a specific recipient
  // turns it off. Keeps the picker semantically consistent — broadcast or
  // targeted, never both.
  function handleRecipientChange(next: string[]) {
    setRecipientsTouched(true);
    const hadAll = recipientSelection.includes(ALL_TRUSTED_VALUE);
    const hasAll = next.includes(ALL_TRUSTED_VALUE);
    if (!hadAll && hasAll) {
      setRecipientSelection([ALL_TRUSTED_VALUE]);
      return;
    }
    if (hadAll && next.length > 1) {
      setRecipientSelection(next.filter((v) => v !== ALL_TRUSTED_VALUE));
      return;
    }
    setRecipientSelection(next);
  }

  function resolveRecipientConfig(): {
    mode: RecipientMode;
    sharedWithGroups: Id<"recipient_groups">[];
    sharedWithContacts: Id<"trusted_contacts">[];
    derivedAccessLevel: AccessLevel;
  } {
    // "All trust contacts" sentinel → store as default mode. The release
    // fan-out's resolver expands default to every accepted trust contact.
    if (recipientSelection.includes(ALL_TRUSTED_VALUE)) {
      return {
        mode: "default",
        sharedWithGroups: [],
        sharedWithContacts: [],
        derivedAccessLevel: "trusted_only",
      };
    }

    const groupIds = recipientSelection
      .filter((v) => v.startsWith(GROUP_PREFIX))
      .map((v) => v.slice(GROUP_PREFIX.length) as Id<"recipient_groups">);
    const contactIds = recipientSelection
      .filter((v) => v.startsWith(CONTACT_PREFIX))
      .map((v) => v.slice(CONTACT_PREFIX.length) as Id<"trusted_contacts">);

    if (groupIds.length === 0 && contactIds.length === 0) {
      // Empty selection = private. Mode "default" means "all trust contacts"
      // in the resolver, but private items are skipped at release time so
      // this never fires distribution.
      return {
        mode: "default",
        sharedWithGroups: [],
        sharedWithContacts: [],
        derivedAccessLevel: "private",
      };
    }

    if (contactIds.length > 0 && groupIds.length === 0) {
      return {
        mode: "explicit",
        sharedWithGroups: [],
        sharedWithContacts: contactIds,
        derivedAccessLevel: "trusted_only",
      };
    }

    return {
      mode: "groups",
      sharedWithGroups: groupIds,
      sharedWithContacts: contactIds,
      derivedAccessLevel: "trusted_only",
    };
  }

  function ingestFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    const accepted: PreparedFile[] = [];
    for (const file of incoming) {
      if (!ACCEPTED_TYPES.split(",").includes(file.type)) {
        setError(t("editor.errorUnsupportedType", { name: file.name }));
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(t("editor.errorTooLarge", { name: file.name }));
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
    meta: { mimeType: string; durationSec: number },
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
        name: `${
          isVideo ? t("recorder.videoMessage") : t("recorder.voiceMessage")
        } — ${stamp}.${ext}`,
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
    setCategory(
      isIntroMode
        ? "conditional_message"
        : (defaultCategory ?? "personal_document"),
    );
    setFiles([]);
    setLinkUrls([""]);
    setRecorderMode(null);
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
      setError(t("dialog.errorNoKey"));
      return;
    }
    if (!title.trim()) {
      setError(t("dialog.errorNameRequired"));
      return;
    }

    const cleanUrls = linkUrls.map((u) => u.trim()).filter(Boolean);
    const invalidUrl = cleanUrls.find((u) => !isValidUrl(u));
    if (invalidUrl) {
      setError(t("editor.errorInvalidUrl", { url: invalidUrl }));
      return;
    }

    if (
      isLetter &&
      !isIntroMode &&
      triggerType === "time_based" &&
      !releaseDate
    ) {
      setError(t("dialog.errorReleaseDate"));
      return;
    }

    if (isIntroMode && recipientSelection.length === 0) {
      setError(t("dialog.errorIntroRecipient"));
      return;
    }

    setSaving(true);
    setError("");

    try {
      const recipientConfig = resolveRecipientConfig();

      const allTrustedSelected = recipientSelection.includes(ALL_TRUSTED_VALUE);
      let resolvedRecipients: WrapRecipient[] = [];
      if (allTrustedSelected) {
        // Wrap DEKs to every current trust contact so each one can decrypt
        // at release time. The recipientMode stays "default" on the item,
        // so future contacts also get the intro via the fan-out resolver.
        resolvedRecipients = allContacts.map(toWrapRecipient);
      } else if (recipientConfig.mode === "explicit") {
        const byId = new Map(allContacts.map((c) => [c._id, c]));
        resolvedRecipients = recipientConfig.sharedWithContacts
          .map((id) => byId.get(id))
          .filter((c): c is NonNullable<typeof c> => Boolean(c))
          .map(toWrapRecipient);
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
          .map(toWrapRecipient);
      } else {
        // mode "default" — empty selection. The item is private (no
        // recipients) so we don't need any wrapped DEKs beyond the owner's.
        resolvedRecipients = [];
      }

      setProgress(t("dialog.progressGenKey"));
      let wrap = await generateDekAndWrap(resolvedRecipients);

      // Verify-before-wrap (finding #2): if a recipient's encryption key could
      // not be authenticated, BLOCK the save. The owner may explicitly re-pin a
      // deliberate identity change, after which we retry once; otherwise we
      // abort so no item is created with a recipient the contacts can't safely
      // decrypt.
      if (wrap.blocked.length > 0) {
        const retry = await showBlockedWrapAlert(wrap.blocked);
        if (!retry) {
          setSaving(false);
          setProgress("");
          return;
        }
        wrap = await generateDekAndWrap(resolvedRecipients);
        if (wrap.blocked.length > 0) {
          await showBlockedWrapAlert(wrap.blocked);
          setSaving(false);
          setProgress("");
          return;
        }
      }
      const { dek, ownerWrap, recipientWraps } = wrap;

      setProgress(t("dialog.progressSealing"));
      const textPayload = body.trim();
      const encryptedContent = await encryptContentWithKey(textPayload, dek);
      const encryptedLinks =
        cleanUrls.length > 0
          ? await encryptContentWithKey(serializeLinks(cleanUrls), dek)
          : undefined;

      const triggerArgs =
        isLetter && !isIntroMode
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
        isReleaseIntroduction: isIntroMode || undefined,
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

      handleOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, t("dialog.errorSave")));
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
              <span>
                {isIntroMode ? "Life Check" : t("dialog.breadcrumbVault")}
              </span>
              <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
              <span className="text-on-surface-variant/50">
                {isIntroMode
                  ? t("dialog.breadcrumbWelcome")
                  : t("dialog.breadcrumbNewAsset")}
              </span>
            </div>
            <DialogTitle className="text-headline-md">
              {isIntroMode ? t("dialog.titleIntro") : t("dialog.titleVault")}
            </DialogTitle>
            <DialogDescription className="text-body-md max-w-md">
              {isIntroMode
                ? t("dialog.descriptionIntro")
                : t("dialog.descriptionVault")}
            </DialogDescription>
          </div>
          <DialogClose className="p-2 hover:bg-surface-container-high rounded-xl transition-colors cursor-pointer">
            <Icon
              path={ICON_PATHS.close}
              className="w-5 h-5 text-on-surface-variant"
              strokeWidth={2}
            />
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
            <SectionHeading
              step="01"
              title={
                isIntroMode ? t("dialog.section01Intro") : t("dialog.section01")
              }
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={cn("space-y-2", isIntroMode && "md:col-span-2")}>
                <Label className="text-label-md text-on-surface-variant">
                  {isIntroMode ? t("dialog.fieldTitle") : t("dialog.fieldName")}
                </Label>
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    isIntroMode
                      ? t("dialog.titlePlaceholder")
                      : t("dialog.namePlaceholder")
                  }
                  required
                />
              </div>
              {!isIntroMode && (
                <div className="space-y-2">
                  <Label className="text-label-md text-on-surface-variant">
                    {t("dialog.fieldCategory")}
                  </Label>
                  <Select<VaultCategory>
                    value={category}
                    onValueChange={setCategory}
                    placeholder={t("dialog.categoryPlaceholder")}
                  >
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.key} value={cat.key}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              )}
              <div className="md:col-span-2 space-y-2">
                <Label className="text-label-md text-on-surface-variant">
                  {isIntroMode
                    ? t("dialog.fieldYourMessage")
                    : isLetter
                      ? t("dialog.fieldMessage")
                      : t("dialog.fieldDescription")}{" "}
                  {!isLetter && !isIntroMode && (
                    <span className="text-outline-variant normal-case tracking-normal">
                      {t("dialog.optional")}
                    </span>
                  )}
                </Label>
                <RichTextEditor
                  value={body}
                  onChange={setBody}
                  placeholder={
                    isIntroMode
                      ? t("dialog.bodyPlaceholderIntro")
                      : isLetter
                        ? t("dialog.bodyPlaceholderLetter")
                        : t("dialog.bodyPlaceholderAsset")
                  }
                  minHeight={isLetter || isIntroMode ? 240 : 160}
                />
              </div>

              {isLetter && !isIntroMode && (
                <div className="md:col-span-2 space-y-2">
                  <Label className="text-label-md text-on-surface-variant">
                    {t("triggers.label")}
                  </Label>
                  <Select<TriggerType>
                    value={triggerType}
                    onValueChange={setTriggerType}
                    placeholder={t("triggers.placeholder")}
                  >
                    {TRIGGER_OPTIONS.map((opt) => {
                      const label = t(`triggers.${opt.key}.label`);
                      return (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          label={label}
                          description={t(`triggers.${opt.key}.hint`)}
                        >
                          {label}
                        </SelectItem>
                      );
                    })}
                  </Select>
                </div>
              )}

              {isLetter && !isIntroMode && triggerType === "time_based" && (
                <div className="md:col-span-2 space-y-2">
                  <Label className="text-label-md text-on-surface-variant">
                    {t("dialog.releaseOn")}
                  </Label>
                  <DatePicker
                    value={releaseDate}
                    onChange={setReleaseDate}
                    min={new Date().toISOString().split("T")[0]}
                    placeholder={t("dialog.releaseDatePlaceholder")}
                  />
                </div>
              )}

              {isLetter &&
                !isIntroMode &&
                triggerType === "life_check_failure" && (
                  <div className="md:col-span-2">
                    <InfoCallout icon={ICON_PATHS.heartbeat}>
                      {t("dialog.lifeCheckCalloutPrefix")}{" "}
                      <Link
                        href="/life-check"
                        className="text-secondary font-semibold hover:underline"
                      >
                        {t("dialog.lifeCheckCalloutLink")}
                      </Link>
                      {t("dialog.lifeCheckCalloutSuffix")}
                    </InfoCallout>
                  </div>
                )}

              {isIntroMode && (
                <div className="md:col-span-2">
                  <InfoCallout icon={ICON_PATHS.heartbeat}>
                    {t("dialog.introCallout")}
                  </InfoCallout>
                </div>
              )}
            </div>
          </section>

          {/* Section 02 — Secure Documentation */}
          <section className="bg-surface-container-low rounded-2xl p-6">
            <SectionHeading step="02" title={t("dialog.section02")} />

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
                    isDragging &&
                      "bg-surface-container-high/80 border-secondary/40",
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
                        <Icon
                          path={iconForKind(file.kind)}
                          className="w-4 h-4"
                        />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-body-md font-bold text-primary truncate max-w-[200px]">
                          {file.name}
                        </p>
                        <p className="text-label-md text-on-surface-variant">
                          {formatFileSize(file.size)}
                          {duration ? ` • ${duration}` : ""} •{" "}
                          {t("attachments.encrypted")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        aria-label={t("dialog.removeFile", { name: file.name })}
                        className="ml-1 p-1 rounded-md text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors cursor-pointer"
                      >
                        <Icon
                          path={ICON_PATHS.close}
                          className="w-4 h-4"
                          strokeWidth={2}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 03 — Linked URLs (hidden for intro mode) */}
          {!isIntroMode && (
            <section className="bg-surface-container-low rounded-2xl p-6">
              <SectionHeading step="03" title={t("dialog.section03")} />
              <VaultLinkInputList urls={linkUrls} onChange={setLinkUrls} />
            </section>
          )}

          {/* Section 04 — Transmission Logic */}
          <section className="bg-surface-container-low rounded-2xl p-6">
            <SectionHeading
              step={isIntroMode ? "03" : "04"}
              title={
                isIntroMode ? t("dialog.section04Intro") : t("dialog.section04")
              }
            />
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-label-md text-on-surface-variant">
                  {isIntroMode
                    ? t("recipients.labelIntro")
                    : t("recipients.label")}
                </Label>
                <MultiSelect
                  options={recipientOptions}
                  selected={recipientSelection}
                  onChange={
                    isIntroMode
                      ? handleRecipientChange
                      : (next) => {
                          setRecipientsTouched(true);
                          setRecipientSelection(next);
                        }
                  }
                  placeholder={
                    isIntroMode
                      ? t("recipients.allContacts")
                      : t("recipients.placeholderPrivate")
                  }
                  searchPlaceholder={t("recipients.searchPlaceholder")}
                  emptyMessage={t("recipients.emptyMessage")}
                  renderTrigger={(selected) => {
                    if (selected.length === 0) {
                      return (
                        <span className="text-outline-variant">
                          {isIntroMode
                            ? t("recipients.placeholderIntro")
                            : t("recipients.placeholderPrivate")}
                        </span>
                      );
                    }
                    const labels = selected
                      .map(
                        (v) =>
                          recipientOptions.find((o) => o.value === v)?.label,
                      )
                      .filter(Boolean);
                    return (
                      <span className="truncate">{labels.join(", ")}</span>
                    );
                  }}
                />
                <p className="text-label-md text-on-surface-variant/70">
                  {isIntroMode
                    ? t("recipients.helperIntro")
                    : t("recipients.helper")}
                </p>
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
              <Icon
                path={ICON_PATHS.arrowRight}
                className="w-4 h-4 rotate-180"
                strokeWidth={2}
              />
              {t("dialog.cancel")}
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
                <span>
                  {saving
                    ? t("dialog.sealing")
                    : isIntroMode
                      ? t("dialog.saveWelcome")
                      : t("dialog.secureToVault")}
                </span>
                <Icon
                  path={ICON_PATHS.lock}
                  className="w-5 h-5"
                  strokeWidth={1.75}
                />
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
