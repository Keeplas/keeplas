import { useQuery } from "convex/react";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useParams, useRouter } from "@/lib/navigation";
import { useState, useEffect, useMemo } from "react";
import { api } from "@keeplas/backend/_generated/api";
import { useVaultCrypto } from "@/lib/use-vault-crypto";
import {
  useRecipientCrypto,
  type WrapRecipient,
} from "@/lib/use-recipient-crypto";
import { toWrapRecipient, type BlockedContact } from "@/lib/verify-contact-key";
import { useBlockedWrapAlert } from "@/lib/use-blocked-wrap-alert";
import { useMasterKey } from "@/lib/master-key-context";
import { getErrorMessage } from "@/lib/utils";
import { getCategoryConfig, type VaultCategory } from "@/lib/vault-categories";
import { useCategoryLabel, useSortedCategories } from "@/lib/use-categories";
import { VaultItemAttachments } from "@/components/vault-item-attachments";
import { AttachmentCapture } from "@/components/attachment-capture";
import {
  formatFileSize,
  iconForKind,
  type PreparedFile,
} from "@/lib/attachment-capture";
import { VaultLinkList } from "@/components/vault-link-list";
import { VaultLinkInputList } from "@/components/vault-link-input-list";
import { MultiSelect, type MultiSelectOption } from "@/components/multi-select";
import { parseLinks, serializeLinks, isValidUrl } from "@/lib/link-payload";
import { normalizeContentForRichText } from "@/lib/normalize-content-for-rich-text";
import { useUploadQueue } from "@/lib/upload-queue";
import { useTranslations } from "@/lib/i18n";
import type { Doc, Id } from "@keeplas/backend/_generated/dataModel";
import type { AccessLevel } from "@keeplas/backend/shared_types";
import {
  Button,
  Icon,
  Input,
  Label,
  ErrorAlert,
  RichTextEditor,
  Select,
  SelectItem,
  Spinner,
  Loader,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  toast,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

const GROUP_PREFIX = "group:";
const CONTACT_PREFIX = "contact:";

export default function VaultItemPage() {
  const t = useTranslations("vault");
  const categoryLabel = useCategoryLabel();
  const sortedCategories = useSortedCategories();
  const params = useParams();
  const router = useRouter();
  const itemId = params.itemId as Id<"vault_items">;

  const item = useQuery(api.vault_items.getItem, { itemId });
  const itemFiles = useQuery(api.vault_items.getItemFiles, { itemId });
  const updateItem = useAuditedMutation(api.vault_items.updateItem);
  const deleteItem = useAuditedMutation(api.vault_items.deleteItem);
  const removeItemFile = useAuditedMutation(api.vault_items.removeItemFile);
  const {
    decryptContent,
    decryptContentWithKey,
    encryptContent,
    encryptContentWithKey,
    isReady,
  } = useVaultCrypto();
  const { enqueueAttachments } = useUploadQueue();
  const { masterKey } = useMasterKey();
  const {
    generateDekAndWrap,
    wrapExistingDek,
    unwrapOwnerDek,
    isReady: cryptoReady,
  } = useRecipientCrypto();
  const showBlockedWrapAlert = useBlockedWrapAlert();

  const recipientGroupsRaw = useQuery(api.recipient_groups.listGroups);
  const allContactsRaw = useQuery(api.trusted_contacts.getContacts);
  const recipientGroups = useMemo(
    () => recipientGroupsRaw ?? [],
    [recipientGroupsRaw],
  );
  const allContacts = useMemo(() => allContactsRaw ?? [], [allContactsRaw]);

  const [decryptedTitle, setDecryptedTitle] = useState<string>("");
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [decryptedLinks, setDecryptedLinks] = useState<string[]>([]);
  const [decrypting, setDecrypting] = useState(false);
  // Per-item DEK (ZK items only). `null` = still unwrapping, `undefined` = not
  // a ZK item (use master key), `CryptoKey` = ready.
  const [itemDek, setItemDek] = useState<CryptoKey | null | undefined>(
    undefined,
  );
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editLinkUrls, setEditLinkUrls] = useState<string[]>([""]);
  const [editCategory, setEditCategory] =
    useState<VaultCategory>("personal_document");
  const [editRecipientSelection, setEditRecipientSelection] = useState<
    string[]
  >([]);
  const [removedFileIds, setRemovedFileIds] = useState<
    Set<Id<"vault_item_files">>
  >(new Set());
  const [stagedFiles, setStagedFiles] = useState<PreparedFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState("");
  const [error, setError] = useState("");

  const recipientOptions = useMemo<MultiSelectOption[]>(() => {
    const groupOpts: MultiSelectOption[] = recipientGroups.map((g) => ({
      value: `${GROUP_PREFIX}${g._id}`,
      label: g.name,
      hint:
        g.memberContactIds.length === 1
          ? t("recipients.contactCountOne", { count: 1 })
          : t("recipients.contactCountOther", {
              count: g.memberContactIds.length,
            }),
      groupLabel: t("recipients.groupsLabel"),
    }));
    const contactOpts: MultiSelectOption[] = allContacts.map((c) => ({
      value: `${CONTACT_PREFIX}${c._id}`,
      label: c.name,
      hint: c.email,
      groupLabel: t("recipients.individualsLabel"),
    }));
    return [...groupOpts, ...contactOpts];
  }, [recipientGroups, allContacts, t]);

  // Decrypt content + linked URLs when item loads. ZK items unwrap the
  // owner-wrapped DEK first (cached for attachments + future re-encrypt);
  // legacy aes_256_gcm items fall back to the master key.
  useEffect(() => {
    if (!item || !isReady || decryptedContent || decrypting) return;
    const isZk = item.encryptionType === "zero_knowledge";
    if (isZk && !cryptoReady) return;

    (async () => {
      setDecrypting(true);
      if (isZk) setItemDek(null);

      let dek: CryptoKey | undefined;
      try {
        if (isZk) {
          if (!item.ownerWrappedDek) {
            throw new Error("Missing owner wrap on zero-knowledge item");
          }
          dek = await unwrapOwnerDek({ wrappedDek: item.ownerWrappedDek });
          setItemDek(dek);
        } else {
          setItemDek(undefined);
        }

        const decryptOne = (payload: string) =>
          dek ? decryptContentWithKey(payload, dek) : decryptContent(payload);

        const [title, content, links] = await Promise.all([
          item.encryptedTitle
            ? decryptOne(item.encryptedTitle).catch(() => item.title ?? "")
            : Promise.resolve(item.title ?? ""),
          decryptOne(item.encryptedContent).catch(() => "[Unable to decrypt]"),
          item.encryptedLinks
            ? decryptOne(item.encryptedLinks)
                .then(parseLinks)
                .catch(() => [] as string[])
            : Promise.resolve([] as string[]),
        ]);
        setDecryptedTitle(title);
        setDecryptedContent(content);
        setDecryptedLinks(links);
      } catch {
        setDecryptedTitle(item.title ?? "");
        setDecryptedContent("[Unable to decrypt]");
        setDecryptedLinks([]);
        if (isZk) setItemDek(undefined);
      } finally {
        setDecrypting(false);
      }
    })();
  }, [
    item,
    isReady,
    cryptoReady,
    decryptedContent,
    decrypting,
    decryptContent,
    decryptContentWithKey,
    unwrapOwnerDek,
  ]);

  function startEditing() {
    if (!item || decryptedContent === null) return;
    setEditTitle(decryptedTitle);
    setEditContent(normalizeContentForRichText(decryptedContent));
    setEditLinkUrls(decryptedLinks.length > 0 ? decryptedLinks : [""]);
    setEditCategory(item.category);

    const initial: string[] = [];
    const mode = item.recipientMode ?? "default";
    if (mode === "groups") {
      for (const gid of item.sharedWithGroups ?? []) {
        initial.push(`${GROUP_PREFIX}${gid}`);
      }
    } else if (mode === "explicit") {
      for (const cid of item.sharedWithContacts ?? []) {
        initial.push(`${CONTACT_PREFIX}${cid}`);
      }
    } else if (mode === "default" && item.accessLevel !== "private") {
      // Legacy "default = all trust contacts": prefer the user's default group.
      const defaultGroup = recipientGroups.find((g) => g.isDefault);
      if (defaultGroup) initial.push(`${GROUP_PREFIX}${defaultGroup._id}`);
    }
    setEditRecipientSelection(initial);

    setRemovedFileIds(new Set());
    setStagedFiles([]);
    setError("");

    setEditing(true);
  }

  function cancelEditing() {
    setRemovedFileIds(new Set());
    setStagedFiles([]);
    setError("");
    setEditing(false);
  }

  function toggleRemoveExisting(fileId: Id<"vault_item_files">) {
    setRemovedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }

  function removeStaged(stagedId: string) {
    setStagedFiles((prev) => prev.filter((f) => f.id !== stagedId));
  }

  function resolveEditRecipientConfig(): {
    mode: "default" | "groups" | "explicit";
    sharedWithGroups: Id<"recipient_groups">[];
    sharedWithContacts: Id<"trusted_contacts">[];
    derivedAccessLevel: AccessLevel;
  } {
    const groupIds = editRecipientSelection
      .filter((v) => v.startsWith(GROUP_PREFIX))
      .map((v) => v.slice(GROUP_PREFIX.length) as Id<"recipient_groups">);
    const contactIds = editRecipientSelection
      .filter((v) => v.startsWith(CONTACT_PREFIX))
      .map((v) => v.slice(CONTACT_PREFIX.length) as Id<"trusted_contacts">);

    if (groupIds.length === 0 && contactIds.length === 0) {
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady || !cryptoReady || !item) return;

    const cleanUrls = editLinkUrls.map((u) => u.trim()).filter(Boolean);
    const invalidUrl = cleanUrls.find((u) => !isValidUrl(u));
    if (invalidUrl) {
      setError(t("editor.errorInvalidUrl", { url: invalidUrl }));
      return;
    }
    const contentPayload = editContent;
    const linksPayload = serializeLinks(cleanUrls);

    setSaving(true);
    setSavingProgress("");
    setError("");

    try {
      const config = resolveEditRecipientConfig();

      const byId = new Map(allContacts.map((c) => [c._id, c]));
      let resolvedRecipients: WrapRecipient[] = [];
      if (config.mode === "explicit") {
        resolvedRecipients = config.sharedWithContacts
          .map((id) => byId.get(id))
          .filter((c): c is NonNullable<typeof c> => Boolean(c))
          .map(toWrapRecipient);
      } else if (config.mode === "groups") {
        const groupSet = new Set(config.sharedWithGroups);
        const memberSet = new Set<string>();
        for (const g of recipientGroups) {
          if (!groupSet.has(g._id)) continue;
          for (const cid of g.memberContactIds) memberSet.add(cid);
        }
        resolvedRecipients = Array.from(memberSet)
          .map((id) => byId.get(id as Id<"trusted_contacts">))
          .filter((c): c is NonNullable<typeof c> => Boolean(c))
          .map(toWrapRecipient);
      }

      let encryptedTitle: string;
      let encryptedContent: string;
      let encryptedLinks: string;
      let ownerWrappedDek: string | undefined;
      let recipientKeysPayload: Array<{
        contactId: Id<"trusted_contacts">;
        wrappedDek: string;
      }> = [];
      // Contacts whose key isn't published yet (`unverifiable`): the save isn't
      // blocked on them — they're recorded as pending and re-wrapped later by
      // useBackfillPendingShares once they publish.
      let pendingRecipientsPayload: Id<"trusted_contacts">[] = [];
      let nextEncryptionType: "aes_256_gcm" | "zero_knowledge" =
        "zero_knowledge";
      // The DEK we should use to encrypt newly-added attachments under,
      // matching whatever the item currently lives under.
      let attachmentDek: CryptoKey | undefined;

      // Verify-before-wrap (finding #2). HARD failures (signature_invalid /
      // fingerprint_changed) are a possible server key substitution — still
      // BLOCKING: alert, allow one re-pin retry, abort if unresolved. DEFERRABLE
      // failures (unverifiable — contact hasn't published a key yet) don't
      // block: returned so the caller records them as pending. Shared by both
      // ZK branches so the policy is identical.
      // Returns null to abort, otherwise the deferrable contacts to defer.
      const isHard = (b: BlockedContact) =>
        b.reason === "signature_invalid" || b.reason === "fingerprint_changed";
      const guardBlocked = async (
        wrap: { blocked: BlockedContact[] },
        retryWrap: () => Promise<{ blocked: BlockedContact[] }>,
      ): Promise<BlockedContact[] | null> => {
        let current = wrap;
        let hard = current.blocked.filter(isHard);
        if (hard.length > 0) {
          const retry = await showBlockedWrapAlert(hard);
          if (!retry) return null;
          current = await retryWrap();
          hard = current.blocked.filter(isHard);
          if (hard.length > 0) {
            await showBlockedWrapAlert(hard);
            return null;
          }
        }
        return current.blocked.filter((b) => b.reason === "unverifiable");
      };

      setSavingProgress(t("editor.progressEncrypting"));
      if (item.ownerWrappedDek) {
        const dek =
          itemDek ??
          (await unwrapOwnerDek({ wrappedDek: item.ownerWrappedDek }));
        attachmentDek = dek;
        encryptedTitle = await encryptContentWithKey(editTitle.trim(), dek);
        encryptedContent = await encryptContentWithKey(contentPayload, dek);
        encryptedLinks = await encryptContentWithKey(linksPayload, dek);
        let wraps = await wrapExistingDek(dek, resolvedRecipients);
        const deferred = await guardBlocked(wraps, async () => {
          wraps = await wrapExistingDek(dek, resolvedRecipients);
          return wraps;
        });
        if (deferred === null) {
          setSaving(false);
          setSavingProgress("");
          return;
        }
        pendingRecipientsPayload = deferred.map(
          (b) => b.contactId as Id<"trusted_contacts">,
        );
        ownerWrappedDek = wraps.ownerWrap.wrappedDek;
        recipientKeysPayload = wraps.recipientWraps.map((rw) => ({
          contactId: rw.contactId as Id<"trusted_contacts">,
          wrappedDek: rw.wrappedDek,
        }));
      } else if (item.encryptionType === "zero_knowledge") {
        // Item flagged ZK but somehow missing the owner wrap — re-key it.
        let fresh = await generateDekAndWrap(resolvedRecipients);
        const deferred = await guardBlocked(fresh, async () => {
          fresh = await generateDekAndWrap(resolvedRecipients);
          return fresh;
        });
        if (deferred === null) {
          setSaving(false);
          setSavingProgress("");
          return;
        }
        pendingRecipientsPayload = deferred.map(
          (b) => b.contactId as Id<"trusted_contacts">,
        );
        attachmentDek = fresh.dek;
        encryptedTitle = await encryptContentWithKey(
          editTitle.trim(),
          fresh.dek,
        );
        encryptedContent = await encryptContentWithKey(
          contentPayload,
          fresh.dek,
        );
        encryptedLinks = await encryptContentWithKey(linksPayload, fresh.dek);
        ownerWrappedDek = fresh.ownerWrap.wrappedDek;
        recipientKeysPayload = fresh.recipientWraps.map((rw) => ({
          contactId: rw.contactId as Id<"trusted_contacts">,
          wrappedDek: rw.wrappedDek,
        }));
      } else {
        // Legacy item still encrypted under master key — keep that flow.
        // Recipient release won't work on legacy items until they're re-saved
        // with files re-encrypted. For now, save with master-key content.
        encryptedTitle = await encryptContent(editTitle.trim());
        encryptedContent = await encryptContent(contentPayload);
        encryptedLinks = await encryptContent(linksPayload);
        nextEncryptionType = "aes_256_gcm";
      }

      await updateItem({
        itemId,
        encryptedTitle,
        encryptedContent,
        encryptedLinks,
        category: editCategory,
        accessLevel: config.derivedAccessLevel,
        recipientMode: config.mode,
        sharedWithGroups: config.sharedWithGroups,
        sharedWithContacts: config.sharedWithContacts,
        ...(nextEncryptionType === "zero_knowledge" && ownerWrappedDek
          ? {
              ownerWrappedDek,
              recipientKeys: recipientKeysPayload,
              pendingRecipients: pendingRecipientsPayload,
            }
          : {}),
      });

      // Some selected contacts hadn't published their key yet — the save
      // wasn't blocked; flag the deferred shares so the owner knows they'll be
      // wrapped automatically once those contacts publish.
      if (pendingRecipientsPayload.length > 0) {
        const deferredNames = resolvedRecipients
          .filter((r) =>
            pendingRecipientsPayload.includes(
              r.contactId as Id<"trusted_contacts">,
            ),
          )
          .map((r) => r.name ?? "A contact")
          .join(", ");
        toast({
          title: t("dialog.deferredShareTitle"),
          description: t("dialog.deferredShareBody", { names: deferredNames }),
        });
      }

      // Attachment removals — independent of metadata update.
      if (removedFileIds.size > 0) {
        setSavingProgress(t("editor.progressRemoving"));
        for (const fileId of removedFileIds) {
          await removeItemFile({ itemId, fileId });
        }
      }

      // Hand attachment additions to the background queue so the editor
      // can close immediately. The queue encrypts under the same key as
      // the item (or master key for legacy items), uploads with progress,
      // and calls addItemFiles per file as it completes — the page
      // subscribes reactively, so attachments appear progressively.
      if (stagedFiles.length > 0) {
        const dekForFiles = attachmentDek ?? masterKey;
        if (!dekForFiles) {
          throw new Error(t("editor.errorNoKey"));
        }
        enqueueAttachments({
          itemId,
          label: editTitle.trim(),
          dek: dekForFiles,
          files: stagedFiles.map((f) => ({
            blob: f.blob,
            name: f.name,
            mimeType: f.mimeType,
            kind: f.kind,
            durationSec: f.durationSec,
          })),
        });
      }

      setDecryptedContent(contentPayload);
      setDecryptedLinks(cleanUrls);
      setRemovedFileIds(new Set());
      setStagedFiles([]);
      setEditing(false);
    } catch (err) {
      setError(getErrorMessage(err, t("editor.errorUpdate")));
    } finally {
      setSaving(false);
      setSavingProgress("");
    }
  }

  const DELETE_CONFIRM_TOKEN = "DELETE";
  const canConfirmDelete = deleteConfirmInput.trim() === DELETE_CONFIRM_TOKEN;

  function openDeleteDialog() {
    setDeleteConfirmInput("");
    setShowDeleteConfirm(true);
  }

  function handleDeleteDialogChange(open: boolean) {
    setShowDeleteConfirm(open);
    if (!open) setDeleteConfirmInput("");
  }

  async function handleDelete() {
    if (!canConfirmDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteItem({ itemId });
      router.push("/vault");
    } finally {
      setDeleting(false);
    }
  }

  if (item === undefined) {
    return <Loader />;
  }

  if (item === null) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24">
        <h2 className="text-headline-md text-primary mb-2">
          {t("detail.notFound")}
        </h2>
        <button
          onClick={() => router.push("/vault")}
          className="text-secondary font-bold cursor-pointer"
        >
          {t("detail.backToVault")}
        </button>
      </div>
    );
  }

  const category = getCategoryConfig(item.category);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push("/vault")}
        className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary font-label font-bold mb-8 transition-colors cursor-pointer"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
          />
        </svg>
        {t("detail.backToVault")}
      </button>

      {editing ? (
        /* ─── Edit Mode ─── */
        <form onSubmit={handleSave} className="space-y-5">
          <h2 className="text-headline-md text-primary mb-6">
            {t("editor.title")}
          </h2>

          {error && <ErrorAlert message={error} className="mb-0" />}

          <div className="space-y-2">
            <Label>{t("editor.fieldTitle")}</Label>
            <Input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t("editor.fieldCategory")}</Label>
            <Select<VaultCategory>
              value={editCategory}
              onValueChange={setEditCategory}
            >
              {sortedCategories.map((cat) => (
                <SelectItem key={cat.key} value={cat.key}>
                  {categoryLabel(cat.key)}
                </SelectItem>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("editor.fieldContent")}</Label>
            <RichTextEditor
              value={editContent}
              onChange={setEditContent}
              placeholder={t("editor.contentPlaceholder")}
              minHeight={200}
            />
          </div>

          <div className="space-y-2">
            <VaultLinkInputList
              urls={editLinkUrls}
              onChange={setEditLinkUrls}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("editor.fieldAttachments")}</Label>
            <div className="space-y-2">
              {(itemFiles ?? []).map((file) => {
                const removed = removedFileIds.has(file._id);
                return (
                  <ExistingAttachmentRow
                    key={file._id}
                    file={file}
                    removed={removed}
                    onToggle={() => toggleRemoveExisting(file._id)}
                  />
                );
              })}
              {stagedFiles.map((file) => (
                <StagedAttachmentRow
                  key={file.id}
                  file={file}
                  onRemove={() => removeStaged(file.id)}
                />
              ))}
              {(itemFiles?.length ?? 0) === 0 && stagedFiles.length === 0 && (
                <p className="text-label-md text-on-surface-variant/70">
                  {t("editor.noAttachments")}
                </p>
              )}
            </div>
            <div className="pt-2">
              <AttachmentCapture
                onAdd={(f) => setStagedFiles((prev) => [...prev, ...f])}
                onError={setError}
              />
              <p className="text-label-md text-on-surface-variant/70 mt-2">
                {t("editor.fileHint")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("recipients.label")}</Label>
            <MultiSelect
              options={recipientOptions}
              selected={editRecipientSelection}
              onChange={setEditRecipientSelection}
              placeholder={t("recipients.placeholderPrivate")}
              searchPlaceholder={t("recipients.searchPlaceholder")}
              emptyMessage={t("recipients.emptyMessage")}
              renderTrigger={(selected) => {
                if (selected.length === 0) {
                  return (
                    <span className="text-outline-variant">
                      {t("recipients.placeholderPrivate")}
                    </span>
                  );
                }
                const labels = selected
                  .map(
                    (v) => recipientOptions.find((o) => o.value === v)?.label,
                  )
                  .filter(Boolean);
                return <span className="truncate">{labels.join(", ")}</span>;
              }}
            />
            <p className="text-label-md text-on-surface-variant/70">
              {t("recipients.helper")}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={cancelEditing}
              disabled={saving}
              className="flex-1 bg-surface-container-low hover:bg-surface-container-high cursor-pointer"
            >
              {t("editor.cancel")}
            </Button>
            <Button
              type="submit"
              variant="vault"
              size="md"
              disabled={saving}
              className="flex-1 text-sm cursor-pointer"
            >
              {saving
                ? savingProgress || t("editor.encrypting")
                : t("editor.saveChanges")}
            </Button>
          </div>
        </form>
      ) : (
        /* ─── View Mode ─── */
        <>
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="w-5 h-5 text-secondary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={category.icon}
                  />
                </svg>
                <span className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                  {categoryLabel(item.category)}
                </span>
              </div>
              <h1 className="text-headline-lg text-primary">
                {decryptedTitle}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={startEditing}
                className="p-2 hover:bg-surface-container-high rounded-xl transition-colors cursor-pointer"
                title={t("detail.edit")}
              >
                <svg
                  className="w-5 h-5 text-on-surface-variant"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                  />
                </svg>
              </button>
              <button
                onClick={openDeleteDialog}
                className="p-2 hover:bg-error-container rounded-xl transition-colors cursor-pointer"
                title={t("detail.deletePermanently")}
              >
                <svg
                  className="w-5 h-5 text-error"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m5.25 0V5.625c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V7.5m-9 0h13.5"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-3 mb-6">
            {(() => {
              const mode = item.recipientMode ?? "default";
              const labels: string[] = [];
              if (mode === "groups") {
                for (const gid of item.sharedWithGroups ?? []) {
                  const g = recipientGroups.find((x) => x._id === gid);
                  if (g) labels.push(g.name);
                }
              } else if (mode === "explicit") {
                for (const cid of item.sharedWithContacts ?? []) {
                  const c = allContacts.find((x) => x._id === cid);
                  if (c) labels.push(c.name);
                }
              }
              const summary =
                item.accessLevel === "private"
                  ? t("detail.summaryPrivate")
                  : labels.length > 0
                    ? t("detail.summaryReleasedTo", {
                        names: labels.join(", "),
                      })
                    : t("detail.summaryReleasedAll");
              return (
                <span className="text-[11px] font-label font-bold text-on-surface-variant bg-surface-container-low px-3 py-1 rounded-lg">
                  {summary}
                </span>
              );
            })()}
          </div>

          {/* Decrypted Content */}
          {(decrypting ||
            (decryptedContent && decryptedContent.length > 0)) && (
            <div className="bg-surface-container-low rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <svg
                  className="w-4 h-4 text-secondary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
                <span className="font-label text-[10px] uppercase tracking-widest font-bold text-secondary">
                  {t("detail.decryptedContent")}
                </span>
              </div>
              {decrypting ? (
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <Spinner size="sm" />
                  {t("detail.decrypting")}
                </div>
              ) : (
                <RichTextEditor
                  readOnly
                  value={normalizeContentForRichText(decryptedContent ?? "")}
                />
              )}
            </div>
          )}

          {decryptedLinks.length > 0 && (
            <div className="bg-surface-container-low rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Icon
                  path={ICON_PATHS.link}
                  className="w-4 h-4 text-secondary"
                  strokeWidth={1.75}
                />
                <span className="font-label text-[10px] uppercase tracking-widest font-bold text-secondary">
                  {t("detail.linkedUrls")}
                </span>
              </div>
              <VaultLinkList urls={decryptedLinks} />
            </div>
          )}

          {/* Secure Attachments */}
          <div className="mb-6">
            <VaultItemAttachments itemId={itemId} itemDek={itemDek} />
          </div>

          {/* Timestamp */}
          <p className="text-[11px] text-outline-variant">
            {t("detail.timestamps", {
              created: new Date(item.createdAt).toLocaleDateString(),
              updated: new Date(item.updatedAt).toLocaleDateString(),
            })}
          </p>

          {/* Delete Confirmation — irreversible */}
          <Dialog
            open={showDeleteConfirm}
            onOpenChange={handleDeleteDialogChange}
          >
            <DialogContent className="max-w-sm p-8 text-left">
              <DialogTitle className="mb-2 text-error">
                {t("delete.title")}
              </DialogTitle>
              <DialogDescription className="mb-4">
                {t("delete.description")}
              </DialogDescription>
              <div className="space-y-2 mb-6">
                <Label htmlFor="delete-confirm-input">
                  {t("delete.confirmPrefix")}{" "}
                  <span className="font-mono font-bold text-error">
                    {DELETE_CONFIRM_TOKEN}
                  </span>{" "}
                  {t("delete.confirmSuffix")}
                </Label>
                <Input
                  id="delete-confirm-input"
                  type="text"
                  autoComplete="off"
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  placeholder={DELETE_CONFIRM_TOKEN}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleDeleteDialogChange(false)}
                  className="flex-1 py-3 bg-surface-container-low hover:bg-surface-container-high rounded-xl font-label font-bold text-sm cursor-pointer"
                >
                  {t("delete.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!canConfirmDelete || deleting}
                  className="flex-1 py-3 bg-error text-on-error rounded-xl font-label font-bold text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? t("delete.deleting") : t("delete.deleteForever")}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function ExistingAttachmentRow({
  file,
  removed,
  onToggle,
}: {
  file: Doc<"vault_item_files">;
  removed: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("vault");
  return (
    <div
      className={`flex items-center gap-3 bg-surface-container-low rounded-xl px-4 py-3 ${
        removed ? "opacity-50" : ""
      }`}
    >
      <div className="w-9 h-9 bg-surface-container-high rounded-lg flex items-center justify-center shrink-0 text-primary">
        <Icon path={iconForKind(file.kind)} className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-headline-sm text-primary truncate ${
            removed ? "line-through" : ""
          }`}
        >
          {file.name}
        </p>
        <p className="text-label-md text-on-surface-variant mt-0.5">
          {formatFileSize(file.size)} · {t("attachments.encrypted")}
          {removed ? ` · ${t("editor.willBeDeleted")}` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="text-label-md font-bold text-on-surface-variant hover:text-error cursor-pointer px-2 py-1 rounded-md"
      >
        {removed ? t("editor.undo") : t("editor.remove")}
      </button>
    </div>
  );
}

function StagedAttachmentRow({
  file,
  onRemove,
}: {
  file: PreparedFile;
  onRemove: () => void;
}) {
  const t = useTranslations("vault");
  return (
    <div className="flex items-center gap-3 bg-secondary/5 rounded-xl px-4 py-3">
      <div className="w-9 h-9 bg-secondary/10 rounded-lg flex items-center justify-center shrink-0 text-secondary">
        <Icon path={iconForKind(file.kind)} className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-headline-sm text-primary truncate">{file.name}</p>
        <p className="text-label-md text-on-surface-variant mt-0.5">
          {formatFileSize(file.size)} · {t("editor.willBeEncrypted")}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-label-md font-bold text-on-surface-variant hover:text-error cursor-pointer px-2 py-1 rounded-md"
      >
        {t("editor.remove")}
      </button>
    </div>
  );
}
