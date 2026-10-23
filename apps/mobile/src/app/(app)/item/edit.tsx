import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { noteToHtml, parseNote } from "@keeplas/export/rich-text";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { NavBar } from "@/components/nav-bar";
import { Chip } from "@/components/rows";
import { Screen } from "@/components/screen";
import { Callout, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { encryptText } from "@/crypto/envelope";
import { PermissionSheet } from "@/features/capture/add-sheet";
import {
  CameraUnavailable,
  chooseFiles,
  chooseFromLibrary,
  PermissionDenied,
  shoot,
  type PermissionProblem,
} from "@/features/capture/media";
import type { CaptureFile } from "@/features/capture/seal";
import { NoteEditor } from "@/features/notes/note-editor";
import { useOutbox } from "@/features/outbox/outbox-provider";
import {
  useOpenedItem,
  type OpenedItem,
} from "@/features/vault/use-opened-item";
import { formatBytes, formatDuration } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";

const KIND_ICON = {
  document: "document",
  image: "photo",
  audio: "mic",
  video: "video",
} as const;

export default function EditItem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = id as Id<"vault_items">;
  const router = useRouter();
  const { t } = useI18n();
  const { raw, opened } = useOpenedItem(itemId);
  const header = <NavBar title={t("itemEdit.title")} onBack={router.back} />;

  if (!raw || !opened) {
    return (
      <Screen header={header} center>
        <Text variant="body" color="text.muted">
          {t("item.decrypting")}
        </Text>
      </Screen>
    );
  }

  return (
    <EditForm
      itemId={itemId}
      opened={opened}
      ownerWrappedDek={raw.ownerWrappedDek ?? ""}
      header={header}
      onDone={router.back}
    />
  );
}

function EditForm({
  itemId,
  opened,
  ownerWrappedDek,
  header,
  onDone,
}: {
  itemId: Id<"vault_items">;
  opened: OpenedItem;
  ownerWrappedDek: string;
  header: ReactNode;
  onDone: () => void;
}) {
  const { t, language } = useI18n();
  const { capture } = useOutbox();
  const updateItem = useAuditedMutation(api.vault_items.updateItem);
  const [title, setTitle] = useState(opened.title);
  const [note, setNote] = useState(opened.note);
  const [removed, setRemoved] = useState<Set<Id<"vault_item_files">>>(
    new Set(),
  );
  const [added, setAdded] = useState<CaptureFile[]>([]);
  const [denied, setDenied] = useState<PermissionProblem | null>(null);
  const [saving, setSaving] = useState(false);
  const kept = opened.files.filter((file) => !removed.has(file.id));

  async function addMedia(get: () => Promise<CaptureFile[]>) {
    try {
      const files = await get();
      if (files.length) setAdded((current) => [...current, ...files]);
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
    if (saving) return;
    setSaving(true);
    try {
      const nextTitle = title.trim() || t("capture.untitled");
      const nextNote = noteToHtml(note);
      const changes = {
        ...(title.trim() !== opened.title.trim()
          ? { encryptedTitle: await encryptText(nextTitle, opened.key) }
          : {}),
        ...(sameNote(nextNote, opened.note)
          ? {}
          : { encryptedContent: await encryptText(nextNote, opened.key) }),
        ...(removed.size ? { removeFileIds: [...removed] } : {}),
      };
      if (Object.keys(changes).length) {
        await updateItem({ itemId, ...changes });
      }
      if (added.length) {
        await capture({
          title: nextTitle,
          note: "",
          files: added,
          attachTo: { itemId, dek: opened.key, ownerWrappedDek },
        });
      }
      onDone();
    } catch {
      toast({
        variant: "error",
        title: t("itemEdit.failedTitle"),
        description: t("itemEdit.failedBody"),
      });
      setSaving(false);
    }
  }

  return (
    <Screen
      header={header}
      gap={16}
      footer={
        <Button
          label={t("capture.save")}
          loading={saving}
          onPress={() => void save()}
        />
      }
    >
      <TextField
        label={t("item.titleRow")}
        value={title}
        onChangeText={setTitle}
        placeholder={t("capture.titlePlaceholder")}
      />
      <NoteEditor
        initialHtml={opened.note}
        placeholder={t("capture.noteBodyPlaceholder")}
        onChange={setNote}
      />
      <Text variant="label">
        {t("capture.attachments", { n: kept.length + added.length })}
      </Text>
      {kept.map((file) => (
        <ListRow
          key={file.id}
          icon={KIND_ICON[file.kind]}
          title={file.name}
          description={formatBytes(file.size, language)}
          trailing={
            <RemoveButton
              label={t("itemEdit.removeFile", { name: file.name })}
              onPress={() =>
                setRemoved((current) => new Set(current).add(file.id))
              }
            />
          }
        />
      ))}
      {added.map((file) => (
        <ListRow
          key={file.uri}
          icon={KIND_ICON[file.kind]}
          title={file.name}
          description={
            file.durationSec ? formatDuration(file.durationSec) : file.mimeType
          }
          trailing={
            <RemoveButton
              label={t("itemEdit.removeFile", { name: file.name })}
              onPress={() =>
                setAdded((current) =>
                  current.filter((candidate) => candidate.uri !== file.uri),
                )
              }
            />
          }
        />
      ))}
      <View style={styles.chips}>
        <Chip
          icon="photo"
          label={t("capture.photoChip")}
          onPress={() => void addMedia(() => chooseFromLibrary(["images"]))}
        />
        <Chip
          icon="camera"
          label={t("itemEdit.cameraChip")}
          onPress={() =>
            void addMedia(async () => {
              const file = await shoot("images");
              return file ? [file] : [];
            })
          }
        />
        <Chip
          icon="cloud-upload"
          label={t("capture.fileChip")}
          onPress={() => void addMedia(chooseFiles)}
        />
      </View>
      <Callout icon="clock" text={t("itemEdit.historyNote")} />
      <PermissionSheet problem={denied} onDismiss={() => setDenied(null)} />
    </Screen>
  );
}

function sameNote(a: string, b: string): boolean {
  return JSON.stringify(parseNote(a)) === JSON.stringify(parseNote(b));
}

function RemoveButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
    >
      <Icon name="close" size={18} color="text.muted" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
