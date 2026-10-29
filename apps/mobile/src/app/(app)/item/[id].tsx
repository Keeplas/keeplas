import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useConvex, useQuery } from "convex/react";
import * as Sharing from "expo-sharing";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { Button } from "@/components/button";
import { Icon, type IconName } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { NavBar } from "@/components/nav-bar";
import { DetailRows } from "@/components/rows";
import { Screen } from "@/components/screen";
import { BottomSheet } from "@/components/sheet";
import { StateMessage } from "@/components/state-message";
import { Checkbox } from "@/components/controls";
import { Callout, IconTile, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { wrapDek } from "@keeplas/crypto/kem";
import { type CategoryChoice } from "@/crypto/item-meta";
import {
  AttachmentPreview,
  PhotoGallery,
  type PreviewFile,
} from "@/features/vault/attachment-preview";
import {
  useDecryptedAttachments,
  type FileUrl,
} from "@/features/vault/use-decrypted-attachment";
import {
  useEveryoneRecipients,
  useWrapForContacts,
} from "@/features/vault/use-recipients";
import type { Attachment } from "@/features/vault/open-sealed-item";
import { useOpenedItem } from "@/features/vault/use-opened-item";
import { useVaultData } from "@/features/vault/vault-data";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";
import {
  CategorySheet,
  useCategoryLabel,
  useRecategorize,
} from "@/features/vault/category-sheet";
import { FILE_ICON, itemVisual } from "@/features/vault/item-visual";
import { contactSupport } from "@/lib/support";
import { NoteView } from "@/features/notes/note-view";
import { isEmptyNote } from "@keeplas/export/rich-text";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { useVault } from "@/providers/vault-provider";
import { radius, withAlpha } from "@/theme";
import { keepUnlockedWhile } from "@/lib/auto-lock";
import { deviceDraftFiles } from "@/features/capture/draft-db";
import {
  editDraftKey,
  editFilesFolder,
  hasEditChanges,
  type EditDraft,
} from "@/features/vault/edit-draft";
import { removeFormDraft, useStoredFormDraft } from "@/lib/form-drafts";
import { useShowSecuring } from "@/features/capture/securing-sheet";
import { outboxLabel } from "@/features/outbox/outbox";
import { usePendingAttachments } from "@/features/vault/use-pending-attachments";

export default function ItemDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = id as Id<"vault_items">;
  const router = useRouter();
  const { t, language } = useI18n();
  const categoryLabel = useCategoryLabel();
  const { lock } = useVault();
  const { raw, opened, failure, retry: reopen } = useOpenedItem(itemId);
  const pendingFiles = usePendingAttachments(itemId, opened?.key);
  const showSecuring = useShowSecuring();
  const pendingEdit = useStoredFormDraft<EditDraft>(editDraftKey(itemId));
  const versions = useQuery(api.vault_items.getItemVersions, { itemId });
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const { items } = useVaultData();
  const recategorizeItem = useRecategorize();
  const { colors } = useTheme();
  const [selected, setSelected] = useState(0);
  const [pages, setPages] = useState(0);
  const [sheet, setSheet] = useState<"details" | "people" | "category" | null>(
    null,
  );
  const [people, setPeople] = useState<Set<Id<"trusted_contacts">>>(new Set());
  const [sharing, setSharing] = useState(false);
  const wrapFor = useWrapForContacts();
  const updateItem = useAuditedMutation(api.vault_items.updateItem);
  const unarchive = useAuditedMutation(api.vault_items.unarchiveItem);
  const everyone = useEveryoneRecipients();

  const convex = useConvex();
  const fileUrl = useCallback<FileUrl>(
    (fileId) => convex.query(api.vault_items.getItemFileUrl, { fileId }),
    [convex],
  );

  const attachments = useMemo(() => opened?.files ?? [], [opened]);
  const { stateOf, retry } = useDecryptedAttachments(
    attachments,
    opened?.key,
    fileUrl,
  );
  const current = Math.min(selected, Math.max(0, attachments.length - 1));
  const file = attachments[current];
  const photos = useMemo(
    () => attachments.filter((attachment) => attachment.kind === "image"),
    [attachments],
  );

  const access = useMemo(() => {
    if (
      raw?.accessLevel !== "private" &&
      (raw?.recipientMode ?? "default") === "default"
    )
      return t("capture.allContacts");
    const names = new Set<string>();
    for (const contactId of raw?.sharedWithContacts ?? []) {
      const contact = contacts?.find(
        (candidate) => candidate._id === contactId,
      );
      if (contact?.name) names.add(contact.name);
    }
    const list = [...names];
    if (list.length === 0) return t("item.onlyYou");
    return list.length === 1
      ? list[0]
      : t("item.sharedMany", { name: list[0], n: list.length - 1 });
  }, [
    raw?.accessLevel,
    raw?.recipientMode,
    raw?.sharedWithContacts,
    contacts,
    t,
  ]);

  const download = useCallback(async () => {
    const state = file ? stateOf(file.id) : undefined;
    if (!file || state?.status !== "ready") return;
    if (!(await Sharing.isAvailableAsync())) {
      toast({
        variant: "error",
        title: t("item.download"),
        description: t("common.genericError"),
      });
      return;
    }
    await keepUnlockedWhile(() =>
      Sharing.shareAsync(state.uri, {
        mimeType: file.mimeType,
        dialogTitle: file.name,
      }),
    );
  }, [file, stateOf, t]);

  const shareable = (contacts ?? []).filter(
    (contact) => contact.invitationStatus === "accepted",
  );

  function share() {
    setPeople(new Set(raw?.sharedWithContacts ?? []));
    setSheet("people");
  }

  function togglePerson(contactId: Id<"trusted_contacts">, checked: boolean) {
    setPeople((current) => {
      const next = new Set(current);
      if (checked) next.add(contactId);
      else next.delete(contactId);
      return next;
    });
  }

  async function saveSharing() {
    if (!raw || !opened) return;
    setSharing(true);
    try {
      // A legacy item opens with the master key itself: wrapping it to a
      // contact would hand them the whole vault.
      if (!raw.ownerWrappedDek) throw new Error("Legacy items can't be shared");
      const direct = [...people];
      if (direct.length) {
        await updateItem({
          itemId,
          sharedWithContacts: direct,
          recipientMode: "explicit",
          accessLevel: "trusted_only",
          recipientKeys: await wrapFor(opened.key, direct),
          pendingRecipients: [],
        });
      } else {
        // Nobody picked: the item is for every trusted contact.
        const { recipients, pending } = await everyone();
        await updateItem({
          itemId,
          sharedWithContacts: [],
          recipientMode: "default",
          accessLevel: "trusted_only",
          recipientKeys: await Promise.all(
            recipients.map(async ({ contactId, publicKey }) => ({
              contactId,
              wrappedDek: await wrapDek(opened.key, publicKey),
            })),
          ),
          pendingRecipients: pending,
        });
      }
      setSheet(null);
    } catch {
      toast({
        variant: "error",
        title: t("item.shareFailedTitle"),
        description: t("item.shareFailedBody"),
      });
    } finally {
      setSharing(false);
    }
  }

  const header = (
    <NavBar
      title={opened?.title || t("item.title")}
      onBack={router.back}
      right={<LanguageDropdown />}
    />
  );

  if (raw === null) {
    return (
      <Screen header={header} center>
        <StateMessage
          icon="alert-triangle"
          tone="warning"
          title={t("item.missingTitle")}
          body={t("item.missingBody")}
          primary={{ label: t("common.back"), onPress: router.back }}
        />
      </Screen>
    );
  }

  if (failure) {
    return (
      <Screen header={header} center>
        <StateMessage
          icon="lock"
          tone="warning"
          title={t("item.lockedTitle")}
          body={t("item.lockedBody")}
          primary={{
            label: t("common.tryAgain"),
            onPress: reopen,
          }}
          secondary={{ label: t("item.lockVault"), onPress: lock }}
        />
        <Button
          variant="text"
          label={t("item.contactSupport")}
          onPress={() => void contactSupport(failure)}
        />
        <Text variant="caption" color="text.subtle" align="center">
          {t("item.reference", { ref: failure })}
        </Text>
      </Screen>
    );
  }

  if (!opened) {
    return (
      <Screen header={header} center>
        <Text variant="body" color="text.muted">
          {t("item.decrypting")}
        </Text>
      </Screen>
    );
  }

  const handlers = {
    onRetry: retry,
    onLock: lock,
    onShare: () => void download(),
  };
  const preview = (attachment: Attachment): PreviewFile => ({
    id: attachment.id,
    meta: attachment,
    state: stateOf(attachment.id),
  });
  async function recategorize(choice: CategoryChoice) {
    if (!raw || !opened) return;
    await recategorizeItem(raw, opened, choice).catch(() =>
      toast({ variant: "error", title: t("common.genericError") }),
    );
  }

  const archived = raw?.status === "archived";
  const archivedBanner = archived ? (
    <>
      <Callout
        icon="inbox"
        text={t("item.archivedOn", {
          date: formatDate(raw?.archivedAt ?? 0, language),
        })}
      />
      <Button
        variant="secondary"
        label={t("archives.restore")}
        onPress={() =>
          void unarchive({ itemId }).catch(() =>
            toast({ variant: "error", title: t("archives.restoreFailed") }),
          )
        }
      />
    </>
  ) : null;

  const editBanner =
    !archived && hasEditChanges(pendingEdit, opened) ? (
      <>
        <Callout icon="clock" text={t("itemEdit.pending")} />
        <View style={styles.actions}>
          <Button
            variant="secondary"
            label={t("itemEdit.resume")}
            onPress={() => edit()}
          />
          <Button
            variant="text"
            label={t("itemEdit.discard")}
            onPress={confirmDiscardEdit}
          />
        </View>
      </>
    ) : null;

  function confirmDiscardEdit() {
    Alert.alert(t("itemEdit.discardTitle"), t("itemEdit.discardBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("itemEdit.discard"),
        style: "destructive",
        onPress: () => {
          removeFormDraft(editDraftKey(itemId));
          deviceDraftFiles.dropDraft(editFilesFolder(itemId));
        },
      },
    ]);
  }

  function edit() {
    router.push({ pathname: "/item/edit", params: { id: itemId } });
  }

  const pendingBlock = pendingFiles.length ? (
    <>
      <Text variant="label">
        {t("item.uploadingFiles")} · {pendingFiles.length}
      </Text>
      {pendingFiles.map(({ entry, meta, index, ratio }) => (
        <ListRow
          key={`${entry.id}-${index}`}
          icon={meta ? FILE_ICON[meta.kind] : "cloud-upload"}
          title={meta?.name ?? t("item.decrypting")}
          description={
            entry.status === "uploading" || entry.status === "waiting"
              ? t("capture.securing.uploadingBody", {
                  pct: Math.round(ratio * 100),
                })
              : t(`home.outbox.${outboxLabel(entry)}`)
          }
          trailing={<Icon name="cloud-upload" size={18} color="text.muted" />}
          onPress={() => showSecuring(entry.id)}
        />
      ))}
    </>
  ) : null;

  const historyRow = (
    <ListRow
      icon="clock"
      title={t("item.history")}
      description={
        versions?.length
          ? t("item.historyCount", { count: versions.length })
          : t("item.historyEmpty")
      }
      onPress={() =>
        router.push({ pathname: "/item/history", params: { id: itemId } })
      }
    />
  );

  const summary = [
    file ? summaryOf(file, pages, t) : t("item.note"),
    file ? formatBytes(file.size, language) : "",
    access,
  ]
    .filter(Boolean)
    .join(" · ");

  const sheets = (
    <>
      <BottomSheet
        visible={sheet === "details"}
        onDismiss={() => setSheet(null)}
        title={t("item.details")}
      >
        <DetailRows
          rows={[
            ...(file
              ? [
                  {
                    icon: "document" as const,
                    label: t("item.fileName"),
                    value: file.name,
                  },
                  {
                    icon: FILE_ICON[file.kind],
                    label: t("item.fileType"),
                    value: file.mimeType,
                  },
                  {
                    icon: "download" as const,
                    label: t("item.fileSize"),
                    value: formatBytes(file.size, language),
                  },
                ]
              : []),
            {
              icon: "clock",
              label: t("item.added"),
              value: formatDate(raw?.createdAt ?? 0, language),
            },
            {
              icon: "edit",
              label: t("item.updated"),
              value: formatDate(raw?.updatedAt ?? 0, language),
            },
          ]}
        />
      </BottomSheet>

      <BottomSheet
        visible={sheet === "people"}
        onDismiss={() => setSheet(null)}
        title={t("item.shareTitle")}
      >
        <Text variant="body-sm" color="text.muted">
          {t("item.shareBody")}
        </Text>

        {shareable.map((contact) => (
          <Checkbox
            key={contact._id}
            checked={people.has(contact._id)}
            onChange={(checked) => togglePerson(contact._id, checked)}
            label={contact.name}
          />
        ))}
        {shareable.length === 0 ? (
          <Text variant="body-sm" color="text.muted">
            {t("item.shareNobody")}
          </Text>
        ) : null}
        <Button
          label={t("capture.save")}
          loading={sharing}
          disabled={shareable.length === 0}
          onPress={() => void saveSharing()}
        />
        <Button
          variant="text"
          label={t("item.addTrustedPerson")}
          onPress={() => {
            setSheet(null);
            router.push("/people/add");
          }}
        />
      </BottomSheet>
    </>
  );
  const categorySheet = (
    <CategorySheet
      visible={sheet === "category"}
      value={opened}
      onChange={(choice) => void recategorize(choice)}
      onDismiss={() => setSheet(null)}
    />
  );

  if (!file) {
    const summaryItem = items?.find((item) => item.id === itemId);
    const visual = summaryItem
      ? itemVisual(summaryItem)
      : { icon: "note" as const, color: colors.accent };
    const created = raw?.createdAt ?? 0;
    return (
      <Screen header={header} gap={16}>
        <View style={styles.hero}>
          <IconTile
            icon={visual.icon}
            size={72}
            iconSize={32}
            background={withAlpha(visual.color, 0.12)}
            tint={visual.color}
          />
          <Text variant="h2" align="center">
            {opened.title || t("capture.untitled")}
          </Text>
          <Text variant="body-sm" color="text.muted" align="center">
            {t("item.addedOn", { date: formatDate(created, language) })}
          </Text>
        </View>
        {archivedBanner ?? editBanner ?? (
          <Button variant="secondary" label={t("item.edit")} onPress={edit} />
        )}
        {!isEmptyNote(opened.note) ? (
          <View
            style={[
              styles.noteCard,
              {
                backgroundColor: colors["bg.surface"],
                borderColor: colors["border.default"],
              },
            ]}
          >
            <NoteView note={opened.note} />
          </View>
        ) : null}
        <DetailRows
          rows={[
            {
              icon: "edit",
              label: t("item.titleRow"),
              value: opened.title || t("capture.untitled"),
              onPress: edit,
            },
            {
              icon: "document",
              label: t("item.category"),
              value: categoryLabel(opened),
              onPress: () => setSheet("category"),
            },
            {
              icon: "lock",
              label: t("item.access"),
              value: access,
              onPress: share,
            },
          ]}
        />
        <ListRow
          icon="user-plus"
          title={t("item.addPeople")}
          description={t("item.addPeopleBody")}
          onPress={share}
        />
        {pendingBlock}
        {historyRow}
        {categorySheet}
        {sheets}
      </Screen>
    );
  }

  return (
    <Screen header={header} gap={16}>
      {archivedBanner}
      {editBanner}
      <View style={styles.meta}>
        <Icon name="lock" size={14} color="status.active" />
        <Text variant="body-sm" color="text.muted" numberOfLines={1}>
          {summary}
        </Text>
      </View>

      {file?.kind === "image" ? (
        <PhotoGallery
          photos={photos.map(preview)}
          selected={Math.max(0, photos.indexOf(file))}
          onSelect={(index) => setSelected(attachments.indexOf(photos[index]))}
          {...handlers}
        />
      ) : file ? (
        <AttachmentPreview
          file={preview(file)}
          onPages={setPages}
          {...handlers}
        />
      ) : null}

      {!isEmptyNote(opened.note) ? <NoteView note={opened.note} /> : null}

      {file ? (
        <View style={styles.actions}>
          <ActionTile
            icon="user-plus"
            label={t("item.share")}
            onPress={share}
          />
          <ActionTile
            icon="download"
            label={t("item.download")}
            onPress={() => void download()}
            disabled={stateOf(file.id).status !== "ready"}
          />
          {!archived ? (
            <ActionTile icon="edit" label={t("item.edit")} onPress={edit} />
          ) : null}
          <ActionTile
            icon="info"
            label={t("item.details")}
            onPress={() => setSheet("details")}
          />
        </View>
      ) : null}

      {attachments.length > 1 ? (
        <>
          <Text variant="label">
            {t("capture.attachments", { n: attachments.length })}
          </Text>
          {attachments.map((attachment, index) => (
            <ListRow
              key={attachment.id}
              icon={FILE_ICON[attachment.kind]}
              title={attachment.name}
              description={formatBytes(attachment.size, language)}
              trailing={
                index === current ? (
                  <Icon name="check" size={18} color="status.active" />
                ) : undefined
              }
              onPress={() => setSelected(index)}
            />
          ))}
        </>
      ) : null}
      {pendingBlock}

      <DetailRows
        rows={[
          {
            icon: "document",
            label: t("item.category"),
            value: categoryLabel(opened),
            onPress: () => setSheet("category"),
          },
          {
            icon: "lock",
            label: t("item.access"),
            value: access,
            onPress: share,
          },
        ]}
      />
      {historyRow}

      {categorySheet}
      {sheets}
    </Screen>
  );
}

function summaryOf(
  file: Attachment,
  pages: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const extension = file.name.split(".").pop()?.toUpperCase() ?? "";
  switch (file.kind) {
    case "image":
      return `${t("vaultList.photo")} · ${extension}`;
    case "audio":
      return [
        t("vaultList.voiceNote"),
        file.durationSec ? formatDuration(file.durationSec) : "",
      ]
        .filter(Boolean)
        .join(" · ");
    case "video":
      return [
        t("vaultList.video"),
        extension,
        file.durationSec ? formatDuration(file.durationSec) : "",
      ]
        .filter(Boolean)
        .join(" · ");
    default:
      return pages > 0
        ? `${extension} · ${t("item.pages", { count: pages })}`
        : extension;
  }
}

function ActionTile({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: pressed ? colors["bg.subtle"] : colors["bg.surface"],
          borderColor: colors["border.default"],
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Icon name={icon} size={22} color="text.primary" />
      <Text
        variant="body-sm-strong"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actions: { flexDirection: "row", gap: 10 },
  hero: { alignItems: "center", gap: 8, paddingTop: 4 },
  noteCard: { padding: 16, borderWidth: 1, borderRadius: radius.md },
  tile: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderRadius: radius.md,
  },
});
