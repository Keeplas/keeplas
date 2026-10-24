import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useConvex, useQuery } from "convex/react";
import * as Sharing from "expo-sharing";
import type { FunctionReturnType } from "convex/server";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { isEmptyNote } from "@keeplas/export/rich-text";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { BottomSheet } from "@/components/sheet";
import { Callout, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { decryptText } from "@/crypto/envelope";
import { parseFileMeta, type FileMeta } from "@/crypto/item-meta";
import { NoteView } from "@/features/notes/note-view";
import { useOpenedItem } from "@/features/vault/use-opened-item";
import {
  cachedDecrypted,
  downloadDecrypted,
  hasKeptCipher,
  rememberDecrypted,
} from "@/lib/files";
import { formatBytes, formatDate, formatTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { keepUnlockedWhile } from "@/lib/auto-lock";

type VersionDoc = FunctionReturnType<
  typeof api.vault_items.getItemVersions
>[number];

interface OpenedVersion {
  id: Id<"vault_item_versions">;
  title: string;
  note: string;
  savedAt: number;
  replacedAt: number;
  files: (FileMeta & { storageId: string; iv: string })[];
}

const KIND_ICON = {
  document: "document",
  image: "photo",
  audio: "mic",
  video: "video",
} as const;

export default function ItemHistory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = id as Id<"vault_items">;
  const router = useRouter();
  const convex = useConvex();
  const { t, language } = useI18n();
  const { raw, opened } = useOpenedItem(itemId);
  const versions = useQuery(api.vault_items.getItemVersions, { itemId });
  const restore = useAuditedMutation(api.vault_items.restoreItemVersion);
  const [list, setList] = useState<OpenedVersion[]>();
  const [shown, setShown] = useState<OpenedVersion | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const key = opened?.key;
  const when = (at: number) =>
    `${formatDate(at, language)}, ${formatTime(at, language)}`;

  useEffect(() => {
    if (!key || !versions) return;
    let alive = true;
    void Promise.all(versions.map((version) => openVersion(version, key)))
      .then((next) => alive && setList(next))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [key, versions]);

  async function openFile(
    version: OpenedVersion,
    file: OpenedVersion["files"][number],
  ) {
    if (!key || busy) return;
    setBusy(file.storageId);
    try {
      let plain = cachedDecrypted(file.storageId);
      if (!plain) {
        const url = hasKeptCipher(file.storageId)
          ? ""
          : await convex.query(api.vault_items.getVersionFileUrl, {
              versionId: version.id,
              storageId:
                file.storageId as VersionDoc["files"][number]["storageId"],
            });
        if (url === null) throw new Error("missing");
        plain = await downloadDecrypted(
          url,
          file.iv,
          key,
          file.name,
          undefined,
          undefined,
          file.storageId,
        );
        rememberDecrypted(file.storageId, plain);
      }
      const uri = plain.uri;
      await keepUnlockedWhile(() =>
        Sharing.shareAsync(uri, {
          mimeType: file.mimeType,
          dialogTitle: file.name,
        }),
      );
    } catch {
      toast({ variant: "error", title: t("common.genericError") });
    } finally {
      setBusy(null);
    }
  }

  function confirmRestore(version: OpenedVersion) {
    Alert.alert(
      t("itemHistory.restoreTitle"),
      t("itemHistory.restoreBody", { date: when(version.savedAt) }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("itemHistory.restore"),
          onPress: () =>
            void restore({ itemId, versionId: version.id })
              .then(() => {
                setShown(null);
                router.back();
              })
              .catch(() =>
                toast({ variant: "error", title: t("common.genericError") }),
              ),
        },
      ],
    );
  }

  const header = <NavBar title={t("itemHistory.title")} onBack={router.back} />;

  if (!raw || !opened || !list) {
    return (
      <Screen header={header} center>
        <Text variant="body" color="text.muted">
          {t("item.decrypting")}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen header={header} gap={12}>
      <Text variant="h1">{opened.title || t("capture.untitled")}</Text>
      <Callout icon="shield-check" text={t("itemHistory.body")} />
      <ListRow
        icon="check-circle"
        title={t("itemHistory.current")}
        description={t("itemHistory.since", { date: when(raw.updatedAt) })}
      />
      {list.map((version) => (
        <ListRow
          key={version.id}
          icon="clock"
          title={version.title || t("capture.untitled")}
          description={t("itemHistory.versionRange", {
            from: when(version.savedAt),
            to: when(version.replacedAt),
          })}
          onPress={() => setShown(version)}
        />
      ))}
      <ListRow
        icon="plus"
        title={t("itemHistory.created")}
        description={when(raw.createdAt)}
      />

      <BottomSheet
        visible={shown !== null}
        onDismiss={() => setShown(null)}
        title={t("itemHistory.versionOf", {
          date: shown ? when(shown.savedAt) : "",
        })}
      >
        {shown ? (
          <>
            <Text variant="h3">{shown.title || t("capture.untitled")}</Text>
            {!isEmptyNote(shown.note) ? (
              <NoteView note={shown.note} />
            ) : (
              <Text variant="body-sm" color="text.muted">
                {t("itemHistory.noNote")}
              </Text>
            )}
            {shown.files.map((file) => (
              <ListRow
                key={file.storageId}
                icon={KIND_ICON[file.kind]}
                title={file.name}
                description={
                  busy === file.storageId
                    ? t("item.opening")
                    : formatBytes(file.size, language)
                }
                onPress={() => void openFile(shown, file)}
              />
            ))}
            {raw.status !== "archived" ? (
              <Button
                variant="secondary"
                label={t("itemHistory.restore")}
                onPress={() => confirmRestore(shown)}
              />
            ) : null}
          </>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

async function openVersion(
  version: VersionDoc,
  key: CryptoKey,
): Promise<OpenedVersion> {
  const [title, note, files] = await Promise.all([
    version.encryptedTitle ? decryptText(version.encryptedTitle, key) : "",
    decryptText(version.encryptedContent, key),
    Promise.all(
      version.files
        .filter((file) => file.encryptedMeta)
        .map(async (file) => ({
          ...parseFileMeta(await decryptText(file.encryptedMeta!, key)),
          storageId: file.storageId,
          iv: file.iv,
        })),
    ),
  ]);
  return {
    id: version._id,
    title,
    note,
    savedAt: version.savedAt,
    replacedAt: version.replacedAt,
    files,
  };
}
