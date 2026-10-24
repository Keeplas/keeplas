import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { BottomSheet } from "@/components/sheet";
import { ListRow } from "@/components/surfaces";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { SHEET_CLOSE_MS } from "@/features/capture/add-sheet";
import { CategorySheet, useRecategorize } from "./category-sheet";
import { useVaultData, type VaultItemSummary } from "./vault-data";

export function ItemActionsSheet({
  itemId,
  onDismiss,
}: {
  itemId: Id<"vault_items"> | null;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { items } = useVaultData();
  const rawItems = useQuery(api.vault_items.getItemSummaries);
  const recategorize = useRecategorize();
  const archiveItem = useAuditedMutation(api.vault_items.archiveItem);
  // The item being filed elsewhere, kept once this sheet has closed.
  const [filing, setFiling] = useState<VaultItemSummary | null>(null);
  const item = items?.find((candidate) => candidate.id === itemId);
  const title = item?.title ?? t("capture.untitled");

  function close() {
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

  function changeCategory() {
    if (!item) return;
    close();
    setTimeout(() => setFiling(item), SHEET_CLOSE_MS);
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

  const filingRaw = rawItems?.find((candidate) => candidate._id === filing?.id);

  return (
    <>
      <BottomSheet visible={itemId !== null} onDismiss={close} title={title}>
        <ListRow icon="eye" title={t("itemActions.open")} onPress={open} />
        <ListRow icon="edit" title={t("item.edit")} onPress={edit} />
        <ListRow
          icon="folder"
          title={t("categories.move")}
          onPress={changeCategory}
        />
        <ListRow icon="people" title={t("item.shareTitle")} onPress={open} />
        <ListRow
          icon="inbox"
          title={t("itemActions.archive")}
          onPress={archive}
        />
      </BottomSheet>
      <CategorySheet
        visible={filing !== null}
        value={filing ?? { category: "inbox" }}
        onChange={(choice) => {
          if (!filing || !filingRaw) return;
          void recategorize(filingRaw, filing, choice).catch(() =>
            toast({
              variant: "error",
              title: t("itemActions.moveFailed", {
                title: filing.title ?? t("capture.untitled"),
              }),
            }),
          );
        }}
        onDismiss={() => setFiling(null)}
      />
    </>
  );
}
