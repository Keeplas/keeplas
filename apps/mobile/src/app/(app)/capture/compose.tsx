import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { NavAction, NavBar } from "@/components/nav-bar";
import { Chip } from "@/components/rows";
import { Screen } from "@/components/screen";
import { Callout, ListRow } from "@/components/surfaces";
import { TextField } from "@/components/text-field";
import { Text } from "@/components/text";
import { type VaultCategory } from "@/crypto/item-meta";
import { draftStore, useDraft } from "@/features/capture/draft-store";
import { pagesToPdf } from "@/features/capture/media";
import { GROUP_CATEGORY } from "@/features/home/vault-groups";
import { useOutbox } from "@/features/outbox/outbox-provider";
import { useI18n } from "@/providers/i18n-provider";

const CATEGORIES: VaultCategory[] = Object.values(GROUP_CATEGORY);

/** M07-7 / M07-8: review a capture, add text and seal it for the outbox. */
export default function ComposeCapture() {
  const router = useRouter();
  const { t } = useI18n();
  const draft = useDraft();
  const { capture } = useOutbox();
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
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
        title: draft.title.trim() || t("capture.untitled"),
        note: draft.note,
        category: draft.category,
        files,
      });
      draftStore.reset();
      router.replace({ pathname: "/capture/securing", params: { entryId } });
    } catch {
      Alert.alert(t("common.genericError"));
      setBusy(false);
    }
  }

  return (
    <Screen
      header={
        <NavBar
          title={t("capture.reviewTitle")}
          onBack={router.back}
          right={
            <NavAction
              label={t("capture.save")}
              onPress={save}
              disabled={busy}
            />
          }
        />
      }
      footer={
        <Button label={t("capture.secure")} onPress={save} loading={busy} />
      }
    >
      <TextField
        label={t("capture.titleLabel")}
        placeholder={t("capture.titlePlaceholder")}
        value={draft.title}
        onChangeText={(title) => draftStore.update({ title })}
      />
      <TextField
        label={t("capture.noteLabel")}
        placeholder={t("capture.notePlaceholder")}
        value={draft.note}
        onChangeText={(note) => draftStore.update({ note })}
        multiline
      />
      <Text variant="label">{t("capture.organize")}</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((category) => (
          <Chip
            key={category}
            label={t(`capture.category.${category}`)}
            selected={(draft.category ?? "inbox") === category}
            onPress={() => draftStore.update({ category })}
          />
        ))}
      </View>
      {draft.pages.map((uri, index) => (
        <ListRow
          key={uri}
          icon="document"
          title={t("capture.page", { n: index + 1 })}
          trailing={
            <Pressable
              onPress={() =>
                draftStore.update({
                  pages: draft.pages.filter((p) => p !== uri),
                })
              }
            >
              <Icon name="close" size={18} color="text.muted" />
            </Pressable>
          }
        />
      ))}
      {draft.files.map((file) => (
        <ListRow
          key={file.uri}
          icon="document"
          title={file.name}
          description={file.mimeType}
          trailing={
            <Pressable onPress={() => draftStore.removeFile(file.uri)}>
              <Icon name="close" size={18} color="text.muted" />
            </Pressable>
          }
        />
      ))}
      <Callout icon="lock" text={t("capture.localEncryption")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
