import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import * as Sharing from "expo-sharing";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { NavBar } from "@/components/nav-bar";
import { DetailRows } from "@/components/rows";
import { Screen } from "@/components/screen";
import { StateMessage } from "@/components/state-message";
import { Callout, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { decryptText } from "@/crypto/envelope";
import {
  legacyFileMeta,
  parseFileMeta,
  parseItemMeta,
  type FileMeta,
} from "@/crypto/item-meta";
import { AttachmentPreview } from "@/features/vault/attachment-preview";
import { useDecryptedAttachment } from "@/features/vault/use-decrypted-attachment";
import { useVaultData } from "@/features/vault/vault-data";
import { contactKeyMaterial, requireVerifiedKey } from "@/crypto/contact-keys";
import { wrapDek } from "@keeplas/crypto/kem";
import { errorReference } from "@/lib/file-errors";
import { formatBytes, formatDuration } from "@/lib/format";
import { contactSupport } from "@/lib/support";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useVault } from "@/providers/vault-provider";

const KIND_ICON = {
  document: "document",
  image: "photo",
  audio: "mic",
  video: "video",
} as const;

interface Opened {
  key: CryptoKey;
  title: string;
  note: string;
  category: string;
  files: (FileMeta & { id: Id<"vault_item_files">; iv: string })[];
}

export default function ItemDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = id as Id<"vault_items">;
  const router = useRouter();
  const { t } = useI18n();
  const { lock } = useVault();
  const raw = useQuery(api.vault_items.getItem, { itemId });
  const files = useQuery(api.vault_items.getItemFiles, { itemId });
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const { itemKey, folders } = useVaultData();
  const moveItem = useAuditedMutation(api.folders.moveItem);
  const pin = useAuditedMutation(api.trusted_contacts.pinContactIdentity);
  const [opened, setOpened] = useState<Opened>();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState<{
    attempt: number;
    reference: string;
  }>();
  const failure = failed?.attempt === attempt ? failed.reference : undefined;
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!raw || !files) return;
    let alive = true;
    void (async () => {
      try {
        const key = await itemKey(raw);
        const [title, note, category, metas] = await Promise.all([
          raw.encryptedTitle
            ? decryptText(raw.encryptedTitle, key)
            : (raw.title ?? ""),
          decryptText(raw.encryptedContent, key),
          raw.encryptedMeta
            ? decryptText(raw.encryptedMeta, key).then(
                (meta) => parseItemMeta(meta).category,
              )
            : (raw.category ?? "other"),
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
        if (alive) setOpened({ key, title, note, category, files: metas });
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

  const file = opened?.files[selected];
  const { state, retry } = useDecryptedAttachment(
    file?.id,
    file?.iv,
    file?.name ?? "",
    opened?.key,
  );

  const share = useCallback(async () => {
    if (state.status !== "ready" || !file) return;
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert(t("item.share"), t("common.genericError"));
      return;
    }
    await Sharing.shareAsync(state.uri, {
      mimeType: file.mimeType,
      dialogTitle: file.name,
    });
  }, [state, file, t]);

  async function move(folderId: Id<"folders"> | null) {
    if (!raw) return;
    const folder = folders?.find((candidate) => candidate.id === folderId);
    const dek = await itemKey(raw);
    const recipientKeys = await Promise.all(
      (folder?.grants ?? []).map(async (grant) => {
        const contact = contacts?.find(
          (candidate) => candidate._id === grant.contactId,
        );
        if (!contact) throw new Error("Contact unavailable");
        const publicKey = await requireVerifiedKey(
          contactKeyMaterial(contact),
          (contactId, fingerprint) =>
            pin({
              contactId: contactId as Id<"trusted_contacts">,
              fingerprint,
            }),
        );
        return {
          contactId: contact._id,
          wrappedDek: await wrapDek(dek, publicKey),
        };
      }),
    );
    await moveItem({ itemId, folderId, recipientKeys });
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
      <Screen header={header}>
        <Text variant="h1">{t("item.decrypting")}</Text>
      </Screen>
    );
  }

  const folderName = folders?.find((f) => f.id === raw?.folderId)?.name;
  const summary = file
    ? [
        file.name.split(".").pop()?.toUpperCase() ?? "",
        formatBytes(file.size),
        file.durationSec ? formatDuration(file.durationSec) : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : t("item.note");

  return (
    <Screen header={header}>
      <View style={styles.summary}>
        <Icon name="lock" size={14} color="status.active" />
        <Text variant="body-sm" color="text.muted">
          {summary}
        </Text>
      </View>
      {file ? (
        <>
          <AttachmentPreview
            meta={file}
            state={state}
            onRetry={retry}
            onLock={lock}
            onOpen={() => void share()}
          />
          {state.status === "ready" ? (
            <Button
              variant="secondary"
              label={t("item.share")}
              onPress={() => void share()}
            />
          ) : null}
        </>
      ) : null}
      {opened.note ? <Text>{opened.note}</Text> : null}
      {opened.files.length > 1
        ? opened.files.map((attachment, index) => (
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
            icon: "folder",
            label: t("item.category"),
            value: t(`capture.category.${opened.category}`),
          },
          {
            icon: "folder",
            label: t("item.folder"),
            value: folderName ?? t("item.noFolder"),
          },
        ]}
      />
      <Callout icon="lock" text={t("item.encrypted")} />
      <Text variant="label">{t("folders.move")}</Text>
      <ListRow
        icon="mail"
        title={t("folders.noFolder")}
        onPress={() => void move(null)}
      />
      {(folders ?? []).map((folder) => (
        <ListRow
          key={folder.id}
          icon="folder"
          title={folder.name ?? t("folders.title")}
          onPress={() => void move(folder.id)}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
});
