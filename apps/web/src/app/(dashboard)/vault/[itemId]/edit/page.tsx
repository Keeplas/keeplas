import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { contentKind } from "@keeplas/backend/lib/vault_groups";
import { Loader, toast } from "@keeplas/ui";
import {
  NoteEditor,
  type NoteValues,
  type SavedAttachment,
} from "@/components/vault/note-editor";
import { useVaultCapture } from "@/components/vault/use-vault-capture";
import { useVoiceAttach } from "@/components/vault/use-voice-attach";
import { useTranslations } from "@/lib/i18n";
import { itemMetaJson } from "@/lib/item-meta";
import { useParams, useRouter } from "@/lib/navigation";
import { normalizeContentForRichText } from "@/lib/normalize-content-for-rich-text";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useItemLabels } from "@/lib/use-item-labels";
import {
  sharingFields,
  useItemSharing,
  useMoveToFolder,
} from "@/lib/use-item-sharing";
import { useOpenedItem } from "@/lib/use-opened-item";
import { useVaultCrypto } from "@/lib/use-vault-crypto";
import { useUploadQueue } from "@/lib/upload-queue";
import { getErrorMessage } from "@/lib/utils";
import { useVaultData } from "@/lib/vault-data";

const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

/** W06-5 on an existing item: edit its note, files and organization. */
export default function EditItemPage() {
  const t = useTranslations("vaultItem.editor");
  const lists = useTranslations("vaultList");
  const params = useParams();
  const itemId = params.itemId as Id<"vault_items">;
  const router = useRouter();
  const { folders } = useVaultData();
  const labels = useItemLabels();
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const { raw, opened, files } = useOpenedItem(itemId);
  const { encryptContentWithKey } = useVaultCrypto();
  const { wrap, announcePending } = useItemSharing();
  const moveToFolder = useMoveToFolder();
  const updateItem = useAuditedMutation(api.vault_items.updateItem);
  const { enqueueAttachments } = useUploadQueue();
  const voice = useVoiceAttach();
  // "Scan with phone": the scan is saved as its own item (W06-7).
  const capture = useVaultCapture();
  const [saving, setSaving] = useState(false);

  const saved = useMemo<SavedAttachment[]>(
    () =>
      (files ?? []).map((file) => ({
        id: file._id,
        kind: file.kind,
        name: file.name,
        detail:
          raw && opened
            ? labels.detail({
                id: raw._id,
                title: opened.title,
                category: opened.category,
                kind: contentKind([file]),
                files: [file],
                sharing: {
                  accessLevel: raw.accessLevel,
                  recipientMode: raw.recipientMode ?? "default",
                  contacts: raw.sharedWithContacts,
                  groups: raw.sharedWithGroups ?? [],
                },
                createdAt: raw.createdAt,
                updatedAt: raw.updatedAt,
              })
            : "",
      })),
    [files, raw, opened, labels],
  );

  if (!raw || !opened || !files) return <Loader />;

  const welcome = raw.isReleaseIntroduction === true;
  const direct = raw.recipientMode === "explicit" ? raw.sharedWithContacts : [];
  const initialFolder = raw.folderId ?? null;

  async function save(values: NoteValues) {
    if (!raw || !opened) return;
    setSaving(true);
    try {
      const key = opened.key;
      const folderChanged = values.folderId !== initialFolder;
      if (folderChanged && !(await moveToFolder(raw, values.folderId))) return;

      // Sharing is rewritten only when it changed: v1 group and "every
      // trusted contact" shares stay as they are otherwise.
      let sharing: Partial<Parameters<typeof updateItem>[0]> = {};
      if (!sameIds(values.contactIds, direct) || folderChanged) {
        const grantees = (
          folders?.find((folder) => folder.id === values.folderId)?.grants ?? []
        ).map((grant) => grant.contactId);
        const everyone = welcome && values.contactIds.length === 0;
        const wraps = opened.legacy
          ? null
          : await wrap(
              [
                ...(everyone
                  ? (contacts ?? []).map((contact) => contact._id)
                  : values.contactIds),
                ...grantees,
              ],
              key,
            );
        if (!opened.legacy && !wraps) return;
        if (wraps) {
          sharing = {
            ...(everyone
              ? {
                  accessLevel: "trusted_only" as const,
                  recipientMode: "default" as const,
                  sharedWithContacts: [],
                  sharedWithGroups: [],
                }
              : sharingFields(values.contactIds)),
            recipientKeys: wraps.recipientKeys,
            pendingRecipients: wraps.pendingRecipients,
          };
          announcePending(wraps);
        }
      }

      const [encryptedTitle, encryptedContent, encryptedMeta] =
        await Promise.all([
          encryptContentWithKey(values.title, key),
          encryptContentWithKey(values.note, key),
          encryptContentWithKey(
            itemMetaJson(values.category, opened.icon),
            key,
          ),
        ]);
      await updateItem({
        itemId,
        encryptedTitle,
        encryptedContent,
        encryptedMeta,
        ...(values.removed.length > 0 ? { removeFileIds: values.removed } : {}),
        ...sharing,
      });
      enqueueAttachments({
        itemId,
        label: values.title,
        dek: key,
        files: values.added,
      });
      router.replace(`/vault/${itemId}`);
    } catch (error) {
      toast({
        variant: "error",
        title: getErrorMessage(error, t("saveFailed")),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <NoteEditor
        breadcrumb={[
          welcome
            ? { label: t("lifeCheck"), href: "/life-check" }
            : { label: lists("breadcrumb"), href: "/hub" },
          { label: opened.title || t("untitled"), href: `/vault/${itemId}` },
          { label: t("editCrumb") },
        ]}
        heading={welcome ? t("welcomeTitle") : t("editTitle")}
        subtitle={welcome ? t("welcomeSubtitle") : t("editSubtitle")}
        welcome={welcome}
        initial={{
          title: opened.title,
          note: normalizeContentForRichText(opened.note),
          category: opened.category,
          folderId: initialFolder,
          contactIds: direct,
        }}
        saved={saved}
        folders={folders ?? []}
        shareable={!opened.legacy}
        saving={saving ? t("saving") : null}
        onSave={(values) => void save(values)}
        onCancel={() => router.back()}
        onScan={capture.scan}
        onRecordVoice={voice.record}
      />
      {voice.dialog}
      {capture.dialogs}
    </>
  );
}
