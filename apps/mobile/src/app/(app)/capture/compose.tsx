import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

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
import { BottomSheet } from "@/components/sheet";
import { contactKeyMaterial, requireVerifiedKey } from "@/crypto/contact-keys";
import { IconPicker } from "@/features/capture/icon-picker";
import { useVaultData } from "@/features/vault/vault-data";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { pagesToPdf } from "@/features/capture/media";
import { GROUP_CATEGORY } from "@/features/home/vault-groups";
import { useOutbox } from "@/features/outbox/outbox-provider";
import { useI18n } from "@/providers/i18n-provider";

const CATEGORIES: VaultCategory[] = Object.values(GROUP_CATEGORY);

const KIND_ICON = {
  document: "document",
  image: "photo",
  audio: "mic",
  video: "video",
} as const;

/** M07-7 / M07-8: review a capture, add text and seal it for the outbox. */
class FolderKeyMissing extends Error {
  constructor(readonly contactName: string) {
    super("FOLDER_KEY_MISSING");
  }
}

export default function ComposeCapture() {
  const router = useRouter();
  const { t } = useI18n();
  const draft = useDraft();
  const [picking, setPicking] = useState(false);
  const [choosingFolder, setChoosingFolder] = useState(false);
  const { capture } = useOutbox();
  const { folders } = useVaultData();
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const pin = useAuditedMutation(api.trusted_contacts.pinContactIdentity);
  const [busy, setBusy] = useState(false);
  const folder = folders?.find((row) => row.id === draft.folderId);

  async function folderRecipients() {
    if (!folder) return undefined;
    const recipients = await Promise.all(
      folder.grants.map(async (grant) => {
        const contact = contacts?.find((row) => row._id === grant.contactId);
        if (!contact) throw new FolderKeyMissing(grant.contactName);
        const publicKey = await requireVerifiedKey(
          contactKeyMaterial(contact),
          (contactId, fingerprint) =>
            pin({
              contactId: contactId as Id<"trusted_contacts">,
              fingerprint,
            }),
        ).catch(() => {
          throw new FolderKeyMissing(grant.contactName);
        });
        return { contactId: contact._id, publicKey };
      }),
    );
    return { id: folder.id, recipients };
  }

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
        icon: draft.icon,
        folder: await folderRecipients(),
        files,
      });
      draftStore.reset();
      router.replace({ pathname: "/capture/securing", params: { entryId } });
    } catch (error) {
      Alert.alert(
        error instanceof FolderKeyMissing
          ? t("capture.folderKeyTitle")
          : t("common.genericError"),
        error instanceof FolderKeyMissing
          ? t("capture.folderKeyBody", { name: error.contactName })
          : undefined,
      );
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
      <ListRow
        icon={draft.icon ?? "flash"}
        title={t("capture.iconLabel")}
        description={draft.icon ? undefined : t("capture.iconAuto")}
        onPress={() => setPicking(true)}
      />
      <ListRow
        icon="folder"
        title={t("capture.folderLabel")}
        description={
          folder
            ? folder.grants.length
              ? t("capture.folderShared", {
                  name: folder.name ?? t("folders.title"),
                  people: folder.grants.map((g) => g.contactName).join(", "),
                })
              : (folder.name ?? t("folders.title"))
            : t("capture.noFolder")
        }
        onPress={() => setChoosingFolder(true)}
      />
      <BottomSheet
        visible={choosingFolder}
        onDismiss={() => setChoosingFolder(false)}
        title={t("capture.folderLabel")}
      >
        <ListRow
          icon="mail"
          title={t("capture.noFolder")}
          trailing={
            !folder ? (
              <Icon name="check" size={18} color="status.active" />
            ) : undefined
          }
          onPress={() => {
            draftStore.update({ folderId: undefined });
            setChoosingFolder(false);
          }}
        />
        {(folders ?? []).map((row) => (
          <ListRow
            key={row.id}
            icon="folder"
            title={row.name ?? t("folders.title")}
            description={
              row.grants.length
                ? row.grants.map((g) => g.contactName).join(", ")
                : undefined
            }
            trailing={
              row.id === folder?.id ? (
                <Icon name="check" size={18} color="status.active" />
              ) : undefined
            }
            onPress={() => {
              draftStore.update({ folderId: row.id });
              setChoosingFolder(false);
            }}
          />
        ))}
      </BottomSheet>
      <IconPicker
        visible={picking}
        value={draft.icon}
        onChange={(icon) => draftStore.update({ icon })}
        onDismiss={() => setPicking(false)}
      />
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
          icon={KIND_ICON[file.kind]}
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
