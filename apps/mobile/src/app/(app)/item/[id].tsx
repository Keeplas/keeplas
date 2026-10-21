import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
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
import { IconTile, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { decryptText, encryptText } from "@/crypto/envelope";
import {
  legacyFileMeta,
  parseFileMeta,
  itemMetaJson,
  parseItemMeta,
  type ItemMeta,
  type FileMeta,
  type VaultCategory,
} from "@/crypto/item-meta";
import {
  AttachmentPreview,
  PhotoGallery,
  type PreviewFile,
} from "@/features/vault/attachment-preview";
import { useDecryptedAttachments } from "@/features/vault/use-decrypted-attachment";
import {
  useMoveToFolder,
  useWrapForContacts,
} from "@/features/vault/use-move-to-folder";
import { useVaultData } from "@/features/vault/vault-data";
import { errorReference } from "@/lib/file-errors";
import {
  formatBytes,
  formatDate,
  formatDuration,
  formatTime,
} from "@/lib/format";
import { GROUP_CATEGORY } from "@/features/home/vault-groups";
import { itemVisual } from "@/features/vault/item-visual";
import { contactSupport } from "@/lib/support";
import { NoteView } from "@/features/notes/note-view";
import { isEmptyNote } from "@keeplas/export/rich-text";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { useVault } from "@/providers/vault-provider";
import { radius, withAlpha } from "@/theme";

type Attachment = FileMeta & { id: Id<"vault_item_files">; iv: string };

interface Opened {
  key: CryptoKey;
  title: string;
  note: string;
  category: VaultCategory;
  icon?: string;
  files: Attachment[];
}

const KIND_ICON = {
  document: "document",
  image: "photo",
  audio: "mic",
  video: "video",
} as const;

export default function ItemDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = id as Id<"vault_items">;
  const router = useRouter();
  const { t, language } = useI18n();
  const { lock } = useVault();
  const raw = useQuery(api.vault_items.getItem, { itemId });
  const files = useQuery(api.vault_items.getItemFiles, { itemId });
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const { itemKey, folders, items } = useVaultData();
  const { colors } = useTheme();
  const [opened, setOpened] = useState<Opened>();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState<{
    attempt: number;
    reference: string;
  }>();
  const failure = failed?.attempt === attempt ? failed.reference : undefined;
  const [selected, setSelected] = useState(0);
  const [pages, setPages] = useState(0);
  const [sheet, setSheet] = useState<
    "folder" | "details" | "people" | "rename" | "category" | null
  >(null);
  const [people, setPeople] = useState<Set<Id<"trusted_contacts">>>(new Set());
  const [sharing, setSharing] = useState(false);
  const wrapFor = useWrapForContacts();
  const [draftTitle, setDraftTitle] = useState("");
  const updateItem = useAuditedMutation(api.vault_items.updateItem);
  const moveToFolder = useMoveToFolder();

  useEffect(() => {
    if (!raw || !files) return;
    let alive = true;
    void (async () => {
      try {
        const key = await itemKey(raw);
        const [title, note, meta, metas] = await Promise.all([
          raw.encryptedTitle
            ? decryptText(raw.encryptedTitle, key)
            : (raw.title ?? ""),
          decryptText(raw.encryptedContent, key),
          raw.encryptedMeta
            ? decryptText(raw.encryptedMeta, key).then(parseItemMeta)
            : ({ v: 1, category: raw.category ?? "other" } as ItemMeta),
          Promise.all(
            files.map(async (file) => ({
              ...(file.encryptedMeta
                ? parseFileMeta(await decryptText(file.encryptedMeta, key))
                : legacyFileMeta(file)),
              id: file._id,
              iv: file.iv,
            })),
          ),
        ]);
        if (alive)
          setOpened({
            key,
            title,
            note,
            category: meta.category,
            icon: meta.icon,
            files: metas,
          });
      } catch (error) {
        const reference = errorReference();
        if (__DEV__) console.warn(`[item ${reference}]`, error);
        if (alive) setFailed({ attempt, reference });
      }
    })();
    return () => {
      alive = false;
    };
  }, [raw, files, itemKey, attempt]);

  const attachments = useMemo(() => opened?.files ?? [], [opened]);
  const { stateOf, retry } = useDecryptedAttachments(attachments, opened?.key);
  const file = attachments[selected];
  const photos = useMemo(
    () => attachments.filter((attachment) => attachment.kind === "image"),
    [attachments],
  );
  const others = attachments.filter(
    (attachment) => attachment.kind !== "image",
  );
  const folder = folders?.find((candidate) => candidate.id === raw?.folderId);

  const access = useMemo(() => {
    const names = new Set<string>();
    for (const contactId of raw?.sharedWithContacts ?? []) {
      const contact = contacts?.find(
        (candidate) => candidate._id === contactId,
      );
      if (contact?.name) names.add(contact.name);
    }
    for (const grant of folder?.grants ?? []) names.add(grant.contactName);
    const list = [...names];
    if (list.length === 0) return t("item.onlyYou");
    return list.length === 1
      ? list[0]
      : t("item.sharedMany", { name: list[0], n: list.length - 1 });
  }, [raw?.sharedWithContacts, contacts, folder, t]);

  const download = useCallback(async () => {
    const state = file ? stateOf(file.id) : undefined;
    if (!file || state?.status !== "ready") return;
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert(t("item.download"), t("common.genericError"));
      return;
    }
    await Sharing.shareAsync(state.uri, {
      mimeType: file.mimeType,
      dialogTitle: file.name,
    });
  }, [file, stateOf, t]);

  const throughFolder = new Set(
    (folder?.grants ?? []).map((grant) => grant.contactId),
  );
  const shareable = (contacts ?? []).filter(
    (contact) =>
      contact.invitationStatus === "accepted" &&
      !throughFolder.has(contact._id),
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
      const direct = [...people];
      const recipientKeys = await wrapFor(opened.key, [
        ...direct,
        ...throughFolder,
      ]);
      await updateItem({
        itemId,
        sharedWithContacts: direct,
        recipientMode: direct.length ? "explicit" : "default",
        accessLevel: direct.length ? "trusted_only" : "private",
        recipientKeys,
      });
      setSheet(null);
    } catch {
      Alert.alert(t("item.shareFailedTitle"), t("item.shareFailedBody"));
    } finally {
      setSharing(false);
    }
  }

  async function move(folderId: Id<"folders"> | null) {
    if (!raw) return;
    setSheet(null);
    await moveToFolder(raw, folderId).catch(() =>
      Alert.alert(t("item.folder"), t("common.genericError")),
    );
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
            onPress: () => setAttempt((n) => n + 1),
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
  async function rename() {
    const title = draftTitle.trim();
    setSheet(null);
    if (!opened || !title || title === opened.title) return;
    await updateItem({
      itemId,
      encryptedTitle: await encryptText(title, opened.key),
    }).catch(() => Alert.alert(t("common.genericError")));
  }

  async function recategorize(category: VaultCategory) {
    setSheet(null);
    if (!opened || category === opened.category) return;
    await updateItem({
      itemId,
      encryptedMeta: await encryptText(
        itemMetaJson(category, opened.icon),
        opened.key,
      ),
    }).catch(() => Alert.alert(t("common.genericError")));
  }

  const summary = [
    file ? summaryOf(file, pages, t) : t("item.note"),
    file ? formatBytes(file.size) : "",
    access,
  ]
    .filter(Boolean)
    .join(" · ");

  const sheets = (
    <>
      <BottomSheet
        visible={sheet === "folder"}
        onDismiss={() => setSheet(null)}
        title={t("folders.move")}
      >
        <ListRow
          icon="mail"
          title={t("folders.noFolder")}
          trailing={
            !folder ? (
              <Icon name="check" size={18} color="status.active" />
            ) : undefined
          }
          onPress={() => void move(null)}
        />
        {(folders ?? []).map((candidate) => (
          <ListRow
            key={candidate.id}
            icon="folder"
            title={candidate.name ?? t("folders.title")}
            trailing={
              candidate.id === folder?.id ? (
                <Icon name="check" size={18} color="status.active" />
              ) : undefined
            }
            onPress={() => void move(candidate.id)}
          />
        ))}
      </BottomSheet>

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
                    icon: KIND_ICON[file.kind],
                    label: t("item.fileType"),
                    value: file.mimeType,
                  },
                  {
                    icon: "download" as const,
                    label: t("item.fileSize"),
                    value: formatBytes(file.size),
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
        {(folder?.grants ?? []).map((grant) => (
          <Checkbox
            key={grant.grantId}
            checked
            disabled
            onChange={() => undefined}
            label={grant.contactName}
            description={t("item.throughFolder", {
              name: folder?.name ?? t("folders.title"),
            })}
          />
        ))}
        {shareable.map((contact) => (
          <Checkbox
            key={contact._id}
            checked={people.has(contact._id)}
            onChange={(checked) => togglePerson(contact._id, checked)}
            label={contact.name}
          />
        ))}
        {shareable.length === 0 && !folder?.grants.length ? (
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
  const renameSheet = (
    <BottomSheet
      visible={sheet === "rename"}
      onDismiss={() => setSheet(null)}
      title={t("item.renameTitle")}
    >
      <TextField
        label={t("item.titleRow")}
        value={draftTitle}
        onChangeText={setDraftTitle}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => void rename()}
      />
      <Button label={t("capture.save")} onPress={() => void rename()} />
    </BottomSheet>
  );
  const categorySheet = (
    <BottomSheet
      visible={sheet === "category"}
      onDismiss={() => setSheet(null)}
      title={t("item.category")}
    >
      {Object.values(GROUP_CATEGORY).map((category) => (
        <ListRow
          key={category}
          icon="document"
          title={t(`capture.category.${category}`)}
          trailing={
            opened.category === category ? (
              <Icon name="check" size={18} color="status.active" />
            ) : undefined
          }
          onPress={() => void recategorize(category)}
        />
      ))}
    </BottomSheet>
  );

  if (!file) {
    const summaryItem = items?.find((item) => item.id === itemId);
    const visual = summaryItem
      ? itemVisual(summaryItem)
      : { icon: "note" as const, color: colors.accent };
    const created = raw?.createdAt ?? 0;
    const when = `${formatDate(created, language)}, ${formatTime(created, language)}`;
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
              onPress: () => {
                setDraftTitle(opened.title);
                setSheet("rename");
              },
            },
            {
              icon: "document",
              label: t("item.category"),
              value: t(`capture.category.${opened.category}`),
              onPress: () => setSheet("category"),
            },
            {
              icon: "folder",
              label: t("item.folder"),
              value: folder?.name ?? t("item.noFolder"),
              onPress: () => setSheet("folder"),
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
        <Text variant="label">{t("item.activity")}</Text>
        <View style={styles.activity}>
          {(
            [
              ["item.activityAdded", "item.byYou"],
              ["item.activityEncrypted", "item.byYou"],
              ["item.activityUploaded", "item.byKeeplas"],
              ["item.activityProtected", "item.byKeeplas"],
            ] as const
          ).map(([label, actor]) => (
            <View key={label} style={styles.activityRow}>
              <View
                style={[
                  styles.activityDot,
                  { backgroundColor: colors["action.primary"] },
                ]}
              />
              <View style={styles.flexText}>
                <Text variant="label">{t(label)}</Text>
                <Text variant="body-sm" color="text.muted">
                  {when}
                </Text>
              </View>
              <Text variant="body-sm" color="text.muted">
                {t(actor)}
              </Text>
            </View>
          ))}
        </View>
        {renameSheet}
        {categorySheet}
        {sheets}
      </Screen>
    );
  }

  return (
    <Screen header={header} gap={16}>
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
          <ActionTile
            icon="info"
            label={t("item.details")}
            onPress={() => setSheet("details")}
          />
        </View>
      ) : null}

      {photos.length > 0 && others.length > 0
        ? others.map((attachment) => (
            <ListRow
              key={attachment.id}
              icon={KIND_ICON[attachment.kind]}
              title={attachment.name}
              description={formatBytes(attachment.size)}
              onPress={() => setSelected(attachments.indexOf(attachment))}
            />
          ))
        : null}
      {photos.length === 0 && others.length > 1
        ? others.map((attachment, index) => (
            <ListRow
              key={attachment.id}
              icon={KIND_ICON[attachment.kind]}
              title={attachment.name}
              description={formatBytes(attachment.size)}
              trailing={
                index === selected ? (
                  <Icon name="check" size={18} color="status.active" />
                ) : undefined
              }
              onPress={() => setSelected(index)}
            />
          ))
        : null}

      <DetailRows
        rows={[
          {
            icon: "document",
            label: t("item.category"),
            value: t(`capture.category.${opened.category}`),
          },
          {
            icon: "folder",
            label: t("item.folder"),
            value: folder?.name ?? t("item.noFolder"),
            onPress: () => setSheet("folder"),
          },
          {
            icon: "lock",
            label: t("item.access"),
            value: access,
            onPress: share,
          },
        ]}
      />

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
        ? `${extension} · ${pages === 1 ? t("item.onePage") : t("item.pages", { n: pages })}`
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
      <Text variant="body-sm-strong">{label}</Text>
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
  activity: { gap: 14 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  flexText: { flex: 1, gap: 2 },
  tile: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: radius.md,
  },
});
