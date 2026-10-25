import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useConvex } from "convex/react";
import * as Sharing from "expo-sharing";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { isEmptyNote } from "@keeplas/export/rich-text";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { StateMessage } from "@/components/state-message";
import { IconTile, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { NoteView } from "@/features/notes/note-view";
import {
  AttachmentPreview,
  PhotoGallery,
  type PreviewFile,
} from "@/features/vault/attachment-preview";
import { FILE_ICON } from "@/features/vault/item-visual";
import type { Attachment } from "@/features/vault/open-sealed-item";
import {
  useDecryptedAttachments,
  type FileUrl,
} from "@/features/vault/use-decrypted-attachment";
import { useOpenedSharedItem } from "@/features/vault/use-opened-item";
import { keepUnlockedWhile } from "@/lib/auto-lock";
import { formatBytes } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { toast } from "@/lib/toast";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { useVault } from "@/providers/vault-provider";
import { radius } from "@/theme";

/** An item a trusted person left me: read-only, opened on this phone. */
export default function SharedItem() {
  const params = useLocalSearchParams<{ contactId: string; itemId: string }>();
  const contactId = params.contactId as Id<"trusted_contacts">;
  const itemId = params.itemId as Id<"vault_items">;
  const router = useRouter();
  const { t, language } = useI18n();
  const { colors } = useTheme();
  const { lock } = useVault();
  const convex = useConvex();
  const {
    shared,
    opened,
    failure,
    retry: reopen,
  } = useOpenedSharedItem(contactId, itemId);
  const fileUrl = useCallback<FileUrl>(
    (fileId) =>
      convex.query(api.memorial.getMemorialItemFileUrl, { contactId, fileId }),
    [convex, contactId],
  );
  const attachments = useMemo(() => opened?.files ?? [], [opened]);
  const { stateOf, retry } = useDecryptedAttachments(
    attachments,
    opened?.key,
    fileUrl,
  );
  const [selected, setSelected] = useState(0);
  const current = Math.min(selected, Math.max(0, attachments.length - 1));
  const file = attachments[current];
  const photos = useMemo(
    () => attachments.filter((attachment) => attachment.kind === "image"),
    [attachments],
  );

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

  const header = (
    <NavBar
      title={opened?.title || t("shared.title")}
      onBack={router.back}
      right={<LanguageDropdown />}
    />
  );

  if (shared === null) {
    return (
      <Screen header={header} center>
        <StateMessage
          icon="lock"
          tone="warning"
          title={t("shared.notReleasedTitle")}
          body={t("shared.notReleasedBody")}
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
          primary={{ label: t("common.tryAgain"), onPress: reopen }}
          secondary={{ label: t("item.lockVault"), onPress: lock }}
        />
      </Screen>
    );
  }
  if (!shared || !opened) {
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

  return (
    <Screen header={header} gap={16}>
      {file ? null : (
        <View style={styles.hero}>
          <IconTile icon="note" size={72} iconSize={32} />
          <Text variant="h2" align="center">
            {opened.title || t("capture.untitled")}
          </Text>
        </View>
      )}
      <Text variant="body-sm" color="text.muted" align="center">
        {t("shared.leftBy", { name: formatPhone(shared.owner.name) })}
      </Text>

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
          onPages={() => undefined}
          {...handlers}
        />
      ) : null}

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

      {file ? (
        <Button
          variant="secondary"
          label={t("item.download")}
          disabled={stateOf(file.id).status !== "ready"}
          onPress={() => void download()}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: 8, paddingTop: 4 },
  noteCard: { padding: 16, borderWidth: 1, borderRadius: radius.md },
});
