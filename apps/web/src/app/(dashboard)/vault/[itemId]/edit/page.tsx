import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc, Id } from "@keeplas/backend/_generated/dataModel";
import { contentKind } from "@keeplas/backend/lib/vault_groups";
import { Loader, toast } from "@keeplas/ui";
import {
  NoteEditor,
  type NoteValues,
  type SavedAttachment,
} from "@/components/vault/note-editor";
import { ItemUnavailable } from "@/components/vault/item-unavailable";
import { useVaultCapture } from "@/components/vault/use-vault-capture";
import { useVoiceAttach } from "@/components/vault/use-voice-attach";
import { useTranslations } from "@/lib/i18n";
import { itemMetaJson } from "@/lib/item-meta";
import { useParams, useRouter } from "@/lib/navigation";
import { normalizeContentForRichText } from "@/lib/normalize-content-for-rich-text";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useItemLabels } from "@/lib/use-item-labels";
import { useVaultData } from "@/lib/vault-data";
import { sharingFields, useItemSharing } from "@/lib/use-item-sharing";
import {
  summaryOf,
  useOpenedItem,
  type OpenedItem,
} from "@/lib/use-opened-item";
import type { OpenedFile } from "@/lib/use-opened-files";
import { useVaultCrypto } from "@/lib/use-vault-crypto";
import { useUploadQueue } from "@/lib/upload-queue";
import { getErrorMessage } from "@/lib/utils";
import type { VaultItemSummary } from "@/lib/vault-list";

const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

/** W06-5 on an existing item: edit its note, files and organization. */
export default function EditItemPage() {
  const params = useParams();
  const itemId = params.itemId as Id<"vault_items">;
  const labels = useItemLabels();
  const { raw, opened, files, failed } = useOpenedItem(itemId);
  const summary = useMemo(
    () => (raw && opened && files ? summaryOf(raw, opened, files) : undefined),
    [raw, opened, files],
  );

  if (raw === null || failed) return <ItemUnavailable missing={raw === null} />;
  // Who can see the item must be known before the form starts from it.
  if (!raw || !opened || !files || !summary || !labels.ready) {
    return <Loader />;
  }
  return (
    <EditItem
      key={itemId}
      raw={raw}
      opened={opened}
      files={files}
      summary={summary}
    />
  );
}

function EditItem({
  raw,
  opened,
  files,
  summary,
}: {
  raw: Doc<"vault_items">;
  opened: OpenedItem;
  files: OpenedFile[];
  summary: VaultItemSummary;
}) {
  const t = useTranslations("vaultItem.editor");
  const lists = useTranslations("vaultList");
  const router = useRouter();
  const itemId = raw._id;
  const labels = useItemLabels();
  const { categories } = useVaultData();
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const { encryptContentWithKey } = useVaultCrypto();
  const { wrap, announcePending } = useItemSharing();
  const updateItem = useAuditedMutation(api.vault_items.updateItem);
  const { enqueueAttachments } = useUploadQueue();
  const voice = useVoiceAttach();
  // "Scan with phone": the scan is saved as its own item (W06-7).
  const capture = useVaultCapture();
  const [saving, setSaving] = useState(false);
  // Who it is shared with when the form opened (also through v1 groups):
  // sharing is rewritten only if the owner changes it.
  const [recipients] = useState(() => labels.recipients(summary));

  const saved = useMemo<SavedAttachment[]>(
    () =>
      files.map((file) => ({
        id: file._id,
        kind: file.kind,
        name: file.name,
        detail: labels.detail({
          ...summary,
          kind: contentKind([file]),
          files: [file],
        }),
      })),
    [summary, files, labels],
  );

  const welcome = raw.isReleaseIntroduction === true;

  async function save(values: NoteValues) {
    setSaving(true);
    try {
      const key = opened.key;
      // Sharing is rewritten only when it changed: v1 group and "every
      // trusted contact" shares stay as they are otherwise.
      let sharing: Partial<Parameters<typeof updateItem>[0]> = {};
      if (!sameIds(values.contactIds, recipients)) {
        const everyone = welcome && values.contactIds.length === 0;
        const wraps = opened.legacy
          ? null
          : await wrap(
              everyone
                ? (contacts ?? []).map((contact) => contact._id)
                : values.contactIds,
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
            itemMetaJson(values.category, opened.icon, values.categoryId),
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
          categoryId: opened.categoryId,
          contactIds: recipients,
        }}
        saved={saved}
        categories={categories ?? []}
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
