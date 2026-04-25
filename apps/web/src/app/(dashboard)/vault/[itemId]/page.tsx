"use client";

import { useQuery, useMutation } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { api } from "@keeplas/backend/_generated/api";
import { useVaultCrypto } from "@/lib/use-vault-crypto";
import { useRecipientCrypto } from "@/lib/use-recipient-crypto";
import { getErrorMessage } from "@/lib/utils";
import { getCategoryConfig, CATEGORIES, type VaultCategory } from "@/lib/vault-categories";
import { VaultItemAttachments } from "@/components/vault-item-attachments";
import { VaultLinkList } from "@/components/vault-link-list";
import { VaultLinkInputList } from "@/components/vault-link-input-list";
import { MultiSelect, type MultiSelectOption } from "@/components/multi-select";
import { parseLinks, serializeLinks, isValidUrl } from "@/lib/link-payload";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import type { AccessLevel } from "@keeplas/backend/shared_types";
import {
  Button,
  Icon,
  Input,
  Label,
  ErrorAlert,
  Select,
  SelectItem,
  Switch,
  Textarea,
  Spinner,
  Loader,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

const GROUP_PREFIX = "group:";
const CONTACT_PREFIX = "contact:";

export default function VaultItemPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.itemId as Id<"vault_items">;

  const item = useQuery(api.vault_items.getItem, { itemId });
  const updateItem = useMutation(api.vault_items.updateItem);
  const deleteItem = useMutation(api.vault_items.deleteItem);
  const {
    decryptContent,
    encryptContent,
    encryptContentWithKey,
    computeHash,
    isReady,
  } = useVaultCrypto();
  const {
    generateDekAndWrap,
    wrapExistingDek,
    unwrapOwnerDek,
    isReady: cryptoReady,
  } = useRecipientCrypto();

  const recipientGroups = useQuery(api.recipient_groups.listGroups) ?? [];
  const allContacts = useQuery(api.trusted_contacts.getContacts) ?? [];

  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [decryptedLinks, setDecryptedLinks] = useState<string[]>([]);
  const [decrypting, setDecrypting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editLinkUrls, setEditLinkUrls] = useState<string[]>([""]);
  const [editCategory, setEditCategory] = useState<VaultCategory>("personal_document");
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editRecipientSelection, setEditRecipientSelection] = useState<string[]>([]);
  const [editTags, setEditTags] = useState("");
  const [editCritical, setEditCritical] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  // Decrypt content + linked URLs when item loads
  useEffect(() => {
    if (item && isReady && !decryptedContent && !decrypting) {
      setDecrypting(true);
      Promise.all([
        decryptContent(item.encryptedContent).catch(() => "[Unable to decrypt]"),
        item.encryptedLinks
          ? decryptContent(item.encryptedLinks)
              .then(parseLinks)
              .catch(() => [] as string[])
          : Promise.resolve([] as string[]),
      ])
        .then(([content, links]) => {
          setDecryptedContent(content);
          setDecryptedLinks(links);
        })
        .finally(() => setDecrypting(false));
    }
  }, [item, isReady, decryptedContent, decrypting, decryptContent]);

  function startEditing() {
    if (!item || decryptedContent === null) return;
    setEditTitle(item.title);
    setEditDescription(item.description ?? "");
    setEditContent(decryptedContent);
    setEditLinkUrls(decryptedLinks.length > 0 ? decryptedLinks : [""]);
    setEditCategory(item.category);
    setEditIsPublic(item.accessLevel === "public");
    setEditTags(item.tags.join(", "));
    setEditCritical(item.isCritical);

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

    setEditing(true);
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
        derivedAccessLevel: editIsPublic ? "public" : "private",
      };
    }
    if (contactIds.length > 0 && groupIds.length === 0) {
      return {
        mode: "explicit",
        sharedWithGroups: [],
        sharedWithContacts: contactIds,
        derivedAccessLevel: editIsPublic ? "public" : "trusted_only",
      };
    }
    return {
      mode: "groups",
      sharedWithGroups: groupIds,
      sharedWithContacts: contactIds,
      derivedAccessLevel: editIsPublic ? "public" : "trusted_only",
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady || !cryptoReady || !item) return;

    const cleanUrls = editLinkUrls.map((u) => u.trim()).filter(Boolean);
    const invalidUrl = cleanUrls.find((u) => !isValidUrl(u));
    if (invalidUrl) {
      setError(`Invalid URL: ${invalidUrl}`);
      return;
    }
    const contentPayload = editContent;
    const linksPayload = serializeLinks(cleanUrls);

    setSaving(true);
    setError("");

    try {
      const config = resolveEditRecipientConfig();
      const tagList = editTags.split(",").map((t) => t.trim()).filter(Boolean);

      const byId = new Map(allContacts.map((c) => [c._id, c]));
      let resolvedRecipients: Array<{
        contactId: string;
        contactPublicKey?: string;
      }> = [];
      if (config.mode === "explicit") {
        resolvedRecipients = config.sharedWithContacts
          .map((id) => byId.get(id))
          .filter((c): c is NonNullable<typeof c> => Boolean(c))
          .map((c) => ({
            contactId: c._id,
            contactPublicKey: c.contactPublicKey,
          }));
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
          .map((c) => ({
            contactId: c._id,
            contactPublicKey: c.contactPublicKey,
          }));
      }

      let encryptedContent: string;
      let encryptedLinks: string;
      let ownerWrappedDek: string | undefined;
      let ownerWrappedDekIv: string | undefined;
      let recipientKeysPayload: Array<{
        contactId: Id<"trusted_contacts">;
        wrappedDek: string;
        wrappedDekIv: string;
      }> = [];
      let nextEncryptionType: "aes_256_gcm" | "zero_knowledge" = "zero_knowledge";

      if (item.ownerWrappedDek && item.ownerWrappedDekIv !== undefined) {
        const dek = await unwrapOwnerDek({
          wrappedDek: item.ownerWrappedDek,
          wrappedDekIv: item.ownerWrappedDekIv,
        });
        encryptedContent = await encryptContentWithKey(contentPayload, dek);
        encryptedLinks = await encryptContentWithKey(linksPayload, dek);
        const wraps = await wrapExistingDek(dek, resolvedRecipients);
        ownerWrappedDek = wraps.ownerWrap.wrappedDek;
        ownerWrappedDekIv = wraps.ownerWrap.wrappedDekIv;
        recipientKeysPayload = wraps.recipientWraps.map((rw) => ({
          contactId: rw.contactId as Id<"trusted_contacts">,
          wrappedDek: rw.wrappedDek,
          wrappedDekIv: rw.wrappedDekIv,
        }));
      } else if (item.encryptionType === "zero_knowledge") {
        // Item flagged ZK but somehow missing the owner wrap — re-key it.
        const fresh = await generateDekAndWrap(resolvedRecipients);
        encryptedContent = await encryptContentWithKey(contentPayload, fresh.dek);
        encryptedLinks = await encryptContentWithKey(linksPayload, fresh.dek);
        ownerWrappedDek = fresh.ownerWrap.wrappedDek;
        ownerWrappedDekIv = fresh.ownerWrap.wrappedDekIv;
        recipientKeysPayload = fresh.recipientWraps.map((rw) => ({
          contactId: rw.contactId as Id<"trusted_contacts">,
          wrappedDek: rw.wrappedDek,
          wrappedDekIv: rw.wrappedDekIv,
        }));
      } else {
        // Legacy item still encrypted under master key — keep that flow.
        // Recipient release won't work on legacy items until they're re-saved
        // with files re-encrypted. For now, save with master-key content.
        encryptedContent = await encryptContent(contentPayload);
        encryptedLinks = await encryptContent(linksPayload);
        nextEncryptionType = "aes_256_gcm";
      }

      const contentHash = await computeHash(contentPayload);

      await updateItem({
        itemId,
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        encryptedContent,
        encryptedLinks,
        contentHash,
        category: editCategory,
        accessLevel: config.derivedAccessLevel,
        tags: tagList,
        isCritical: editCritical,
        recipientMode: config.mode,
        sharedWithGroups: config.sharedWithGroups,
        sharedWithContacts: config.sharedWithContacts,
        ...(nextEncryptionType === "zero_knowledge" && ownerWrappedDek
          ? {
              ownerWrappedDek,
              ownerWrappedDekIv,
              recipientKeys: recipientKeysPayload,
            }
          : {}),
      });

      setDecryptedContent(contentPayload);
      setDecryptedLinks(cleanUrls);
      setEditing(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await deleteItem({ itemId });
    router.push("/vault");
  }

  if (item === undefined) {
    return <Loader />;
  }

  if (item === null) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24">
        <h2 className="text-headline-md text-primary mb-2">Item not found</h2>
        <button onClick={() => router.push("/vault")} className="text-secondary font-bold cursor-pointer">
          Back to Vault
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
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Vault
      </button>

      {editing ? (
        /* ─── Edit Mode ─── */
        <form onSubmit={handleSave} className="space-y-5">
          <h2 className="text-headline-md text-primary mb-6">
            Edit Item
          </h2>

          {error && (
            <ErrorAlert message={error} className="mb-0" />
          )}

          <div className="space-y-2">
            <Label>Title</Label>
            <Input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select<VaultCategory> value={editCategory} onValueChange={setEditCategory}>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.key} value={cat.key}>{cat.label}</SelectItem>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Secure Content</Label>
            <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} required rows={6} />
          </div>

          <div className="space-y-2">
            <VaultLinkInputList urls={editLinkUrls} onChange={setEditLinkUrls} />
          </div>

          <div className="space-y-2">
            <Label>Who receives this at trigger?</Label>
            <MultiSelect
              options={recipientOptions}
              selected={editRecipientSelection}
              onChange={setEditRecipientSelection}
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
                  .map((v) => recipientOptions.find((o) => o.value === v)?.label)
                  .filter(Boolean);
                return <span className="truncate">{labels.join(", ")}</span>;
              }}
            />
            <p className="text-label-md text-on-surface-variant/70">
              Pick one or more groups (your trust contacts are already a group),
              or specific people. Empty = the item stays private.
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 bg-surface-container-low rounded-xl p-4">
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
              checked={editIsPublic}
              onCheckedChange={setEditIsPublic}
              className="mt-1"
            />
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <Input type="text" value={editTags} onChange={(e) => setEditTags(e.target.value)} />
          </div>

          <div className="flex items-start justify-between gap-4 bg-surface-container-low rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-surface-container-high rounded-full flex items-center justify-center shrink-0 text-primary">
                <Icon path={ICON_PATHS.warning} className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-headline-sm text-primary">
                  Mark as critical
                </p>
                <p className="text-body-md text-on-surface-variant mt-0.5">
                  Critical items are prioritized during emergency access.
                </p>
              </div>
            </div>
            <Switch
              checked={editCritical}
              onCheckedChange={setEditCritical}
              className="mt-1"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setEditing(false)}
              className="flex-1 bg-surface-container-low hover:bg-surface-container-high cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="vault"
              size="md"
              disabled={saving}
              className="flex-1 text-sm cursor-pointer"
            >
              {saving ? "Encrypting..." : "Save Changes"}
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
                <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={category.icon} />
                </svg>
                <span className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                  {category.label}
                </span>
                {item.isCritical && (
                  <span className="text-label-md text-on-primary bg-primary-container px-2 py-0.5 rounded-lg">
                    Critical
                  </span>
                )}
              </div>
              <h1 className="text-headline-lg text-primary">
                {item.title}
              </h1>
              {item.description && (
                <p className="text-body-lg text-on-surface-variant mt-1">{item.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={startEditing}
                className="p-2 hover:bg-surface-container-high rounded-xl transition-colors cursor-pointer" title="Edit">
                <svg className="w-5 h-5 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
              </button>
              <button onClick={() => setShowDeleteConfirm(true)}
                className="p-2 hover:bg-error-container rounded-xl transition-colors cursor-pointer" title="Archive">
                <svg className="w-5 h-5 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m5.25 0V5.625c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V7.5m-9 0h13.5" />
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
                  ? "Private"
                  : labels.length > 0
                    ? `Released to ${labels.join(", ")}`
                    : "Released to all trust contacts";
              return (
                <span className="text-[11px] font-label font-bold text-on-surface-variant bg-surface-container-low px-3 py-1 rounded-lg">
                  {summary}
                </span>
              );
            })()}
            {item.accessLevel === "public" && (
              <span className="text-[11px] font-label font-bold text-on-secondary-container bg-secondary-container px-3 py-1 rounded-lg">
                On Emergency Card
              </span>
            )}
            {item.tags.map((tag) => (
              <span key={tag} className="text-[11px] font-label font-bold text-on-surface-variant bg-surface-container-low px-3 py-1 rounded-lg">
                {tag}
              </span>
            ))}
          </div>

          {/* Decrypted Content */}
          {(decrypting || (decryptedContent && decryptedContent.length > 0)) && (
            <div className="bg-surface-container-low rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                <span className="font-label text-[10px] uppercase tracking-widest font-bold text-secondary">
                  Decrypted Content
                </span>
              </div>
              {decrypting ? (
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <Spinner size="sm" />
                  Decrypting...
                </div>
              ) : (
                <pre className="whitespace-pre-wrap text-sm text-on-surface font-body leading-relaxed">
                  {decryptedContent}
                </pre>
              )}
            </div>
          )}

          {decryptedLinks.length > 0 && (
            <div className="bg-surface-container-low rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Icon path={ICON_PATHS.link} className="w-4 h-4 text-secondary" strokeWidth={1.75} />
                <span className="font-label text-[10px] uppercase tracking-widest font-bold text-secondary">
                  Linked URLs
                </span>
              </div>
              <VaultLinkList urls={decryptedLinks} />
            </div>
          )}

          {/* Secure Attachments */}
          <div className="mb-6">
            <VaultItemAttachments itemId={itemId} />
          </div>

          {/* Timestamp */}
          <p className="text-[11px] text-outline-variant">
            Created {new Date(item.createdAt).toLocaleDateString()} · Updated {new Date(item.updatedAt).toLocaleDateString()}
          </p>

          {/* Delete Confirmation */}
          <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DialogContent className="max-w-sm p-8 text-center">
              <DialogTitle className="mb-2">Archive this item?</DialogTitle>
              <DialogDescription className="mb-6">
                This item will be archived and removed from your active vault. You can restore it later.
              </DialogDescription>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 bg-surface-container-low hover:bg-surface-container-high rounded-xl font-label font-bold text-sm cursor-pointer">
                  Cancel
                </button>
                <button onClick={handleDelete}
                  className="flex-1 py-3 bg-error text-on-error rounded-xl font-label font-bold text-sm cursor-pointer">
                  Archive
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
