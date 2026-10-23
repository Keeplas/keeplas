import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { Icon } from "@/components/icon";
import { BottomSheet } from "@/components/sheet";
import { ListRow } from "@/components/surfaces";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useMoveToFolder } from "./use-move-to-folder";
import { useVaultData } from "./vault-data";

export function ItemActionsSheet({
  itemId,
  onDismiss,
}: {
  itemId: Id<"vault_items"> | null;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { items, folders } = useVaultData();
  const rawItems = useQuery(api.vault_items.getItemSummaries);
  const moveToFolder = useMoveToFolder();
  const archiveItem = useAuditedMutation(api.vault_items.archiveItem);
  const [moving, setMoving] = useState(false);
  const item = items?.find((candidate) => candidate.id === itemId);
  const raw = rawItems?.find((candidate) => candidate._id === itemId);
  const title = item?.title ?? t("capture.untitled");

  function close() {
    setMoving(false);
    onDismiss();
  }

  function open() {
    close();
    if (itemId) router.push({ pathname: "/item/[id]", params: { id: itemId } });
  }

  function edit() {
    close();
    if (itemId) router.push({ pathname: "/item/edit", params: { id: itemId } });
  }

  async function move(folderId: Id<"folders"> | null) {
    if (!raw) return;
    close();
    await moveToFolder(raw, folderId).catch(() =>
      toast({
        variant: "error",
        title: t("item.folder"),
        description: t("itemActions.moveFailed", { title }),
      }),
    );
  }

  function archive() {
    if (!itemId) return;
    close();
    Alert.alert(
      t("itemActions.archiveTitle", { title }),
      t("itemActions.archiveBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("itemActions.archive"),
          onPress: () =>
            void archiveItem({ itemId }).catch(() =>
              toast({
                variant: "error",
                title: t("itemActions.archiveFailed"),
              }),
            ),
        },
      ],
    );
  }

  return (
    <BottomSheet
      visible={itemId !== null}
      onDismiss={close}
      title={moving ? t("folders.move") : title}
    >
      {moving ? (
        <>
          <ListRow
            icon="mail"
            title={t("folders.noFolder")}
            trailing={
              !item?.folderId ? (
                <Icon name="check" size={18} color="status.active" />
              ) : undefined
            }
            onPress={() => void move(null)}
          />
          {(folders ?? []).map((folder) => (
            <ListRow
              key={folder.id}
              icon="folder"
              title={folder.name ?? t("folders.title")}
              trailing={
                folder.id === item?.folderId ? (
                  <Icon name="check" size={18} color="status.active" />
                ) : undefined
              }
              onPress={() => void move(folder.id)}
            />
          ))}
        </>
      ) : (
        <>
          <ListRow icon="eye" title={t("itemActions.open")} onPress={open} />
          <ListRow icon="edit" title={t("item.edit")} onPress={edit} />
          <ListRow
            icon="folder"
            title={t("folders.move")}
            onPress={() => setMoving(true)}
          />
          <ListRow icon="people" title={t("item.shareTitle")} onPress={open} />
          <ListRow
            icon="inbox"
            title={t("itemActions.archive")}
            onPress={archive}
          />
        </>
      )}
    </BottomSheet>
  );
}
