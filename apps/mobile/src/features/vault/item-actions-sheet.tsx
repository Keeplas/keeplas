import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { Icon } from "@/components/icon";
import { BottomSheet } from "@/components/sheet";
import { ListRow } from "@/components/surfaces";
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
  const deleteItem = useAuditedMutation(api.vault_items.deleteItem);
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

  async function move(folderId: Id<"folders"> | null) {
    if (!raw) return;
    close();
    await moveToFolder(raw, folderId).catch(() =>
      Alert.alert(t("item.folder"), t("itemActions.moveFailed", { title })),
    );
  }

  function remove() {
    if (!itemId) return;
    close();
    Alert.alert(
      t("itemActions.deleteTitle", { title }),
      t("itemActions.deleteBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("itemActions.delete"),
          style: "destructive",
          onPress: () =>
            void deleteItem({ itemId }).catch(() =>
              Alert.alert(t("itemActions.deleteFailed")),
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
          <ListRow
            icon="folder"
            title={t("folders.move")}
            onPress={() => setMoving(true)}
          />
          <ListRow icon="people" title={t("item.shareTitle")} onPress={open} />
          <ListRow
            icon="trash"
            title={t("itemActions.delete")}
            onPress={remove}
          />
        </>
      )}
    </BottomSheet>
  );
}
