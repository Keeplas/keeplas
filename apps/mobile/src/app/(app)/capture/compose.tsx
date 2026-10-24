import { useCallback, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { Button } from "@/components/button";
import { Checkbox } from "@/components/controls";
import { Icon, type IconName } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { NavAction, NavBar } from "@/components/nav-bar";
import { Chip, DetailRows } from "@/components/rows";
import { Screen } from "@/components/screen";
import { BottomSheet } from "@/components/sheet";
import { Callout, IconTile, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { ContactKeyBlocked } from "@/crypto/contact-keys";
import { type VaultCategory } from "@/crypto/item-meta";
import { PermissionSheet } from "@/features/capture/add-sheet";
import { captureDepth } from "@/features/capture/capture-depth";
import { draftStore, useDraft } from "@/features/capture/draft-store";
import { IconPicker } from "@/features/capture/icon-picker";
import {
  CameraUnavailable,
  chooseFiles,
  chooseFromLibrary,
  PermissionDenied,
  shoot,
  pagesToPdf,
  type PermissionProblem,
} from "@/features/capture/media";
import type { CaptureFile } from "@/features/capture/seal";
import { useShowSecuring } from "@/features/capture/securing-sheet";
import { GROUP_CATEGORY } from "@/features/home/vault-groups";
import { useOutbox } from "@/features/outbox/outbox-provider";
import { itemVisual } from "@/features/vault/item-visual";
import { useEveryoneRecipients } from "@/features/vault/use-move-to-folder";
import { useVaultData } from "@/features/vault/vault-data";
import { formatDuration } from "@/lib/format";
import { NoteEditor } from "@/features/notes/note-editor";
import { toast } from "@/lib/toast";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius, singleLine, type } from "@/theme";

const CATEGORIES: VaultCategory[] = Object.values(GROUP_CATEGORY);

const KIND_ICON = {
  document: "document",
  image: "photo",
  audio: "mic",
  video: "video",
} as const;

function IconTileBox({ icon }: { icon: IconName }) {
  const { colors } = useTheme();
  return <IconTile icon={icon} size={44} background={colors["bg.info"]} />;
}

type Sheet = "category" | "access" | "icon" | "item" | null;

/** M07-7 / M07-9 New note and M07-8 Review capture, sealed for the outbox. */
export default function ComposeCapture() {
  const router = useRouter();
  const navigation = useNavigation();
  const showSecuring = useShowSecuring();
  const { t } = useI18n();
  const { colors } = useTheme();
  const draft = useDraft();
  const { capture } = useOutbox();
  const { items, itemKey } = useVaultData();
  const rawItems = useQuery(api.vault_items.getItemSummaries);
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const everyone = useEveryoneRecipients();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [targetId, setTargetId] = useState<string>();
  const [search, setSearch] = useState("");
  const [denied, setDenied] = useState<PermissionProblem | null>(null);
  const [busy, setBusy] = useState(false);
  const isNote = draft.kind === "note";
  const updateNote = useCallback(
    (note: string) => draftStore.update({ note }),
    [],
  );
  const target = items?.find((item) => item.id === targetId);
  const hasFiles = draft.files.length + draft.pages.length > 0;
  const existing = mode === "existing" && hasFiles;

  const chosen = (contacts ?? []).filter((contact) =>
    draft.contactIds?.includes(contact._id),
  );
  const access =
    chosen.length === 0
      ? t("capture.allContacts")
      : chosen.length === 1
        ? chosen[0].name
        : t("item.sharedMany", { name: chosen[0].name, n: chosen.length - 1 });

  function toggleContact(contactId: string, checked: boolean) {
    const next = (draft.contactIds ?? []).filter((id) => id !== contactId);
    if (checked) next.push(contactId);
    // Nobody picked: the item is for every trusted contact.
    draftStore.update({ contactIds: next.length ? next : undefined });
  }

  const pickable = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return (items ?? []).filter(
      (item) => !needle || item.title?.toLocaleLowerCase().includes(needle),
    );
  }, [items, search]);

  async function attachTarget() {
    const raw = rawItems?.find((item) => item._id === targetId);
    if (!raw) return undefined;
    return {
      itemId: raw._id,
      dek: await itemKey(raw),
      ownerWrappedDek: raw.ownerWrappedDek ?? "",
    };
  }

  async function addMedia(get: () => Promise<CaptureFile[]>) {
    try {
      const files = await get();
      if (files.length) draftStore.addFiles(files);
    } catch (error) {
      if (error instanceof PermissionDenied) setDenied(error.what);
      else if (error instanceof CameraUnavailable)
        toast({
          variant: "error",
          title: t("capture.noCameraTitle"),
          description: t("capture.noCameraPhotoBody"),
        });
      else toast({ variant: "error", title: t("common.genericError") });
    }
  }

  async function save() {
    if (busy) return;
    if (existing && !targetId) {
      setSheet("item");
      return;
    }
    setBusy(true);
    try {
      let files = draft.files;
      if (draft.pages.length) {
        files = [
          ...files,
          await pagesToPdf(
            draft.pages,
            draft.title.trim() || t("capture.untitledScan"),
          ),
        ];
      }
      const entryId = await capture({
        title: existing
          ? (target?.title ?? t("capture.untitled"))
          : draft.title.trim() ||
            (draft.pages.length
              ? t("capture.untitledScan")
              : t("capture.untitled")),
        note: existing ? "" : draft.note,
        category: draft.category,
        icon: draft.icon,
        folderId: existing ? undefined : draft.folderId,
        share: existing
          ? undefined
          : {
              ...(await everyone(draft.contactIds)),
              contactIds: draft.contactIds,
            },
        attachTo: existing ? await attachTarget() : undefined,
        handoffId: draft.handoffId,
        files,
      });
      draftStore.reset();
      // Back to where the capture started; the upload goes on behind the sheet.
      router.dismiss(
        captureDepth(navigation.getState()?.routes.map((r) => r.name) ?? []),
      );
      showSecuring(entryId);
    } catch (error) {
      const blocked = error instanceof ContactKeyBlocked;
      toast({
        variant: "error",
        title: blocked
          ? t("capture.contactKeyTitle")
          : t("common.genericError"),
        description: blocked
          ? t("capture.contactKeyBody", { name: error.contactName ?? "" })
          : undefined,
      });
      setBusy(false);
    }
  }

  const attachChips: { icon: IconName; label: string; onPress: () => void }[] =
    [
      ...(isNote
        ? [
            {
              icon: "document" as const,
              label: t("capture.scanChip"),
              onPress: () => router.push("/capture/scan"),
            },
          ]
        : []),
      {
        icon: "photo",
        label: t("capture.photoChip"),
        onPress: () => void addMedia(() => chooseFromLibrary(["images"])),
      },
      {
        icon: "mic",
        label: t("capture.voiceChip"),
        onPress: () => router.push("/capture/voice"),
      },
      {
        icon: "cloud-upload",
        label: t("capture.fileChip"),
        onPress: () => void addMedia(chooseFiles),
      },
      ...(isNote
        ? [
            {
              icon: "video" as const,
              label: t("capture.videoChip"),
              onPress: () =>
                void addMedia(async () => {
                  const file = await shoot("videos");
                  return file ? [file] : [];
                }),
            },
          ]
        : []),
    ];

  const detailRows = (
    <DetailRows
      rows={[
        {
          icon: "document",
          label: t("capture.categoryLabel"),
          value: t(`capture.category.${draft.category ?? "inbox"}`),
          onPress: () => setSheet("category"),
        },
        {
          icon: "lock",
          label: t("capture.accessLabel"),
          value: access,
          onPress: () => setSheet("access"),
        },
        {
          icon: draft.icon ?? "flash",
          label: t("capture.iconLabel"),
          value: draft.icon ? t("capture.iconChosen") : t("capture.iconAuto"),
          onPress: () => setSheet("icon"),
        },
      ]}
    />
  );

  const attachmentRows = (
    <>
      {draft.files.map((file) => (
        <ListRow
          key={file.uri}
          icon={KIND_ICON[file.kind]}
          title={file.name}
          description={
            file.durationSec ? formatDuration(file.durationSec) : file.mimeType
          }
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              hitSlop={10}
              onPress={() => draftStore.removeFile(file.uri)}
            >
              <Icon name="close" size={18} color="text.muted" />
            </Pressable>
          }
        />
      ))}
    </>
  );

  const chips = (
    <View style={styles.chips}>
      {attachChips.map((chip) => (
        <Chip
          key={chip.label}
          icon={chip.icon}
          label={chip.label}
          onPress={chip.onPress}
        />
      ))}
    </View>
  );

  const sheets = (
    <>
      <BottomSheet
        visible={sheet === "category"}
        onDismiss={() => setSheet(null)}
        title={t("capture.categoryLabel")}
      >
        {CATEGORIES.map((category) => (
          <ListRow
            key={category}
            icon="document"
            title={t(`capture.category.${category}`)}
            trailing={
              (draft.category ?? "inbox") === category ? (
                <Icon name="check" size={18} color="status.active" />
              ) : undefined
            }
            onPress={() => {
              draftStore.update({ category });
              setSheet(null);
            }}
          />
        ))}
      </BottomSheet>

      <BottomSheet
        visible={sheet === "access"}
        onDismiss={() => setSheet(null)}
        title={t("item.shareTitle")}
      >
        <Text variant="body-sm" color="text.muted">
          {t("item.shareBody")}
        </Text>
        <ListRow
          icon="people"
          title={t("capture.allContacts")}
          trailing={
            draft.contactIds ? undefined : (
              <Icon name="check" size={18} color="status.active" />
            )
          }
          onPress={() => draftStore.update({ contactIds: undefined })}
        />
        {(contacts ?? []).map((contact) => (
          <Checkbox
            key={contact._id}
            checked={draft.contactIds?.includes(contact._id) ?? false}
            onChange={(checked) => toggleContact(contact._id, checked)}
            label={contact.name}
            description={
              contact.invitationStatus === "accepted"
                ? undefined
                : t(`people.status.${contact.invitationStatus}`)
            }
          />
        ))}
        <Button label={t("common.done")} onPress={() => setSheet(null)} />
      </BottomSheet>

      <BottomSheet
        visible={sheet === "item"}
        onDismiss={() => setSheet(null)}
        title={t("capture.chooseItem")}
      >
        <View
          style={[
            styles.search,
            {
              backgroundColor: colors["bg.surface"],
              borderColor: colors["border.default"],
            },
          ]}
        >
          <Icon name="search" size={18} color="text.muted" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("vaultList.search")}
            placeholderTextColor={colors["text.subtle"]}
            accessibilityLabel={t("vaultList.search")}
            style={[
              singleLine(type.body),
              styles.searchInput,
              { color: colors["text.primary"] },
            ]}
          />
        </View>
        {pickable.slice(0, 30).map((item) => (
          <ListRow
            key={item.id}
            icon={itemVisual(item).icon}
            title={item.title ?? t("item.decrypting")}
            description={t(`capture.category.${item.category}`)}
            trailing={
              item.id === targetId ? (
                <Icon name="check" size={18} color="status.active" />
              ) : undefined
            }
            onPress={() => {
              setTargetId(item.id);
              setSheet(null);
            }}
          />
        ))}
        {pickable.length === 0 ? (
          <Text variant="body-sm" color="text.muted" align="center">
            {t("vaultList.noResults")}
          </Text>
        ) : null}
      </BottomSheet>

      <IconPicker
        visible={sheet === "icon"}
        value={draft.icon}
        onChange={(icon) => draftStore.update({ icon })}
        onDismiss={() => setSheet(null)}
      />
      <PermissionSheet problem={denied} onDismiss={() => setDenied(null)} />
    </>
  );

  if (draft.kind === "file" && draft.files.length > 0) {
    const file = draft.files[0];
    const select = (label: string, value: string, onPress?: () => void) => (
      <>
        <Text variant="label">{label}</Text>
        <Pressable
          accessibilityRole={onPress ? "button" : undefined}
          disabled={!onPress}
          onPress={onPress}
          style={[
            styles.select,
            {
              backgroundColor: colors["bg.surface"],
              borderColor: colors["border.strong"],
            },
          ]}
        >
          <Text variant="body" style={styles.flex}>
            {value}
          </Text>
          {onPress ? (
            <Icon name="chevron-down" size={18} color="text.muted" />
          ) : null}
        </Pressable>
      </>
    );
    return (
      <Screen
        header={
          <NavBar
            title={t("capture.addDocumentTitle")}
            onBack={router.back}
            right={<LanguageDropdown />}
          />
        }
        footer={
          <View style={styles.footer}>
            <Button
              label={t("capture.saveAndSecure")}
              onPress={save}
              loading={busy}
            />
            <Button
              variant="text"
              label={t("common.cancel")}
              onPress={() => {
                draftStore.reset();
                router.back();
              }}
            />
          </View>
        }
        gap={12}
      >
        <View
          style={[
            styles.fileCard,
            {
              backgroundColor: colors["bg.surface"],
              borderColor: colors["border.default"],
            },
          ]}
        >
          <IconTileBox icon={KIND_ICON[file.kind]} />
          <View style={styles.flex}>
            <Text variant="label" numberOfLines={1}>
              {file.name}
            </Text>
            <Text variant="body-sm" color="text.muted">
              {t("capture.fromFiles", {
                type: file.name.split(".").pop()?.toUpperCase() ?? "",
              })}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            void addMedia(async () => {
              const picked = await chooseFiles();
              if (picked.length) draftStore.update({ files: [] });
              return picked;
            })
          }
          style={styles.another}
        >
          <Icon name="cloud-upload" size={16} color="accent" />
          <Text variant="body-sm-strong" color="accent">
            {t("capture.chooseAnother")}
          </Text>
        </Pressable>
        <Text variant="label">{t("capture.titleLabel")}</Text>
        <TextInput
          value={draft.title}
          onChangeText={(title) => draftStore.update({ title })}
          placeholder={file.name.replace(/\.[^.]+$/, "")}
          placeholderTextColor={colors["text.subtle"]}
          accessibilityLabel={t("capture.titleLabel")}
          style={[
            singleLine(type.body),
            styles.select,
            {
              color: colors["text.primary"],
              backgroundColor: colors["bg.surface"],
              borderColor: colors["border.strong"],
            },
          ]}
        />
        {select(
          t("capture.categoryLabel"),
          t(`capture.category.${draft.category ?? "inbox"}`),
          () => setSheet("category"),
        )}
        {select(t("capture.whoCanSee"), access, () => setSheet("access"))}
        <Callout icon="shield-check" text={t("capture.neverSees")} />
        {sheets}
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <NavBar
          title={
            isNote
              ? t("capture.newNoteTitle")
              : draft.pages.length
                ? t("capture.reviewScanTitle")
                : t("capture.reviewTitle")
          }
          onBack={router.back}
          right={
            isNote ? (
              <NavAction
                label={t("capture.save")}
                onPress={save}
                disabled={busy}
              />
            ) : (
              <LanguageDropdown />
            )
          }
        />
      }
      footer={
        <View style={styles.footer}>
          <Button
            label={isNote ? t("capture.saveNote") : t("capture.saveAndSecure")}
            chevron={!isNote}
            onPress={save}
            loading={busy}
          />
          {draft.pages.length ? (
            <Button
              variant="secondary"
              label={t("capture.retake")}
              onPress={() => {
                draftStore.update({ pages: [] });
                router.replace("/capture/scan");
              }}
            />
          ) : null}
        </View>
      }
      gap={14}
    >
      {draft.pages.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pages}
        >
          {draft.pages.map((uri, index) => (
            <View
              key={uri}
              style={[
                styles.page,
                {
                  borderColor:
                    index === 0
                      ? colors["border.focus"]
                      : colors["border.default"],
                },
              ]}
            >
              <Image source={{ uri }} style={styles.pageImage} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("capture.page", { n: index + 1 })}
                hitSlop={12}
                onPress={() =>
                  draftStore.update({
                    pages: draft.pages.filter((p) => p !== uri),
                  })
                }
                style={[
                  styles.pageRemove,
                  { backgroundColor: colors["bg.surface"] },
                ]}
              >
                <Icon name="close" size={14} color="text.muted" />
              </Pressable>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/capture/scan")}
            style={[
              styles.page,
              styles.addPage,
              { borderColor: colors["border.strong"] },
            ]}
          >
            <Icon name="plus" size={20} color="text.link" />
            <Text variant="caption" color="text.link">
              {t("capture.addPage")}
            </Text>
          </Pressable>
        </ScrollView>
      ) : null}

      {!existing ? (
        <View
          style={[
            styles.titleRow,
            {
              backgroundColor: colors["bg.surface"],
              borderColor: colors["border.default"],
            },
          ]}
        >
          <TextInput
            value={draft.title}
            onChangeText={(title) => draftStore.update({ title })}
            placeholder={
              isNote
                ? t("capture.noteTitlePlaceholder")
                : draft.pages.length
                  ? t("capture.untitledScan")
                  : t("capture.titlePlaceholder")
            }
            placeholderTextColor={colors["text.subtle"]}
            accessibilityLabel={t("capture.titleLabel")}
            style={[
              singleLine(type["body-lg"]),
              styles.titleInput,
              { color: colors["text.primary"] },
            ]}
          />
          <Icon name="edit" size={18} color="text.link" />
        </View>
      ) : null}
      {draft.pages.length && !existing ? (
        <Text variant="body-sm" color="text.muted">
          {[
            draft.pages.length === 1
              ? t("capture.onePageMeta")
              : t("capture.pagesMeta", { n: draft.pages.length }),
            draft.title.trim() ? "" : t("capture.suggestedTitle"),
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      ) : null}

      {isNote ? (
        <>
          <NoteEditor
            initialHtml={draft.note}
            placeholder={t("capture.noteBodyPlaceholder")}
            onChange={updateNote}
          />
          <View style={styles.sectionRow}>
            <Text variant="label">
              {t("capture.attachments", { n: draft.files.length })}
            </Text>
          </View>
          {attachmentRows}
          <Text variant="label">{t("capture.attachMore")}</Text>
          {chips}
          {detailRows}
          <Callout icon="lock" text={t("capture.noteEncrypted")} />
        </>
      ) : (
        <>
          {!draft.pages.length ? attachmentRows : null}
          {!existing ? (
            <>
              <Text variant="label">{t("capture.addNote")}</Text>
              <TextInput
                value={draft.note}
                onChangeText={(note) => draftStore.update({ note })}
                placeholder={t("capture.notePlaceholder")}
                placeholderTextColor={colors["text.subtle"]}
                accessibilityLabel={t("capture.addNote")}
                multiline
                style={[
                  type.body,
                  styles.reviewNote,
                  {
                    color: colors["text.primary"],
                    backgroundColor: colors["bg.surface"],
                    borderColor: colors["border.strong"],
                  },
                ]}
              />
              <Text variant="body-sm" color="text.muted">
                {t("capture.addNoteHint")}
              </Text>
            </>
          ) : null}

          <Text variant="label">{t("capture.saveAs")}</Text>
          <View
            style={[styles.segment, { backgroundColor: colors["bg.subtle"] }]}
          >
            {(["new", "existing"] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === option }}
                onPress={() => {
                  setMode(option);
                  if (option === "existing" && !targetId) setSheet("item");
                }}
                style={[
                  styles.segmentOption,
                  mode === option && {
                    backgroundColor: colors["bg.surface"],
                  },
                ]}
              >
                <Text
                  variant="body-sm-strong"
                  color={mode === option ? "text.primary" : "text.muted"}
                >
                  {option === "new"
                    ? t("capture.newItem")
                    : t("capture.existingItem")}
                </Text>
              </Pressable>
            ))}
          </View>
          {existing ? (
            <ListRow
              icon={target ? itemVisual(target).icon : "search"}
              title={target?.title ?? t("capture.chooseItem")}
              description={
                target
                  ? t(`capture.category.${target.category}`)
                  : t("capture.chooseItemBody")
              }
              onPress={() => setSheet("item")}
            />
          ) : null}

          <Text variant="label">{t("capture.alsoAttach")}</Text>
          {chips}
          {!existing ? detailRows : null}
          <Callout icon="shield-check" text={t("capture.encryptedTogether")} />
        </>
      )}

      {sheets}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 10 },
  flex: { flex: 1, gap: 2 },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  another: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
  },
  select: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pages: { gap: 10 },
  page: {
    width: 70,
    height: 92,
    borderWidth: 2,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  pageImage: { width: "100%", height: "100%" },
  pageRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addPage: {
    borderStyle: "dashed",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  titleInput: { flex: 1, paddingVertical: 0 },
  reviewNote: {
    minHeight: 84,
    padding: 14,
    borderWidth: 1,
    borderRadius: radius.md,
    textAlignVertical: "top",
  },
  sectionRow: { flexDirection: "row", justifyContent: "space-between" },
  segment: { flexDirection: "row", padding: 4, borderRadius: radius.md },
  segmentOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  searchInput: { flex: 1, paddingVertical: 0 },
});
