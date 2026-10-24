import { useCallback, useMemo, useState } from "react";
import { FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { BottomSheet } from "@/components/sheet";
import { ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { CUSTOM_FALLBACK } from "@/crypto/item-meta";
import { useOpenAddSheet } from "@/features/capture/add-sheet";
import { CategoryNameForm } from "@/features/vault/category-sheet";
import { useDeleteCategory } from "@/features/vault/delete-category";
import { VaultItemRow } from "@/features/vault/item-row";
import { itemVisual } from "@/features/vault/item-visual";
import {
  useVaultData,
  type VaultItemSummary,
} from "@/features/vault/vault-data";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";

/** Items filed under one user-made category; rename or delete it. */
export default function CategoryDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const categoryId = id as Id<"vault_categories">;
  const router = useRouter();
  const { t } = useI18n();
  const { categories, items } = useVaultData();
  const openAdd = useOpenAddSheet();
  const rename = useAuditedMutation(api.vault_categories.rename);
  const remove = useAuditedMutation(api.vault_categories.remove);
  const deleteCategory = useDeleteCategory();
  const [renaming, setRenaming] = useState(false);
  const stored = categories?.find((row) => row.id === id)?.name;
  const name = stored ?? t("item.decrypting");
  const categoryItems = useMemo(
    () => items?.filter((item) => item.categoryId === id) ?? [],
    [items, id],
  );

  const renderItem = useCallback(
    ({ item }: { item: VaultItemSummary }) => (
      <VaultItemRow
        id={item.id}
        title={item.title ?? t("item.decrypting")}
        icon={itemVisual(item).icon}
      />
    ),
    [t],
  );

  return (
    <Screen
      header={<NavBar title={name} onBack={router.back} />}
      scroll={false}
    >
      <FlatList
        data={categoryItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        windowSize={5}
        ListHeaderComponent={
          <>
            <Text variant="h1">{name}</Text>
            <Text color="text.muted">
              {t("categories.items", { n: categoryItems.length })}
            </Text>
            <Button
              label={t("vaultList.addItem")}
              onPress={() =>
                openAdd({ category: CUSTOM_FALLBACK, categoryId: id })
              }
            />
            <ListRow
              icon="edit"
              title={t("categories.rename")}
              onPress={() => setRenaming(true)}
            />
            <ListRow
              icon="trash"
              title={t("categories.delete")}
              onPress={() =>
                deleteCategory.request({
                  name,
                  itemIds: categoryItems.map((item) => item.id),
                  remove: () => remove({ categoryId }),
                  onDeleted: router.back,
                })
              }
            />
          </>
        }
        ListHeaderComponentStyle={{ gap: 16 }}
      />
      <BottomSheet
        visible={renaming}
        onDismiss={() => setRenaming(false)}
        title={t("categories.rename")}
      >
        {renaming ? (
          <CategoryNameForm
            initial={stored ?? ""}
            submitLabel={t("capture.save")}
            onSubmit={async (encryptedName) => {
              await rename({ categoryId, encryptedName });
              setRenaming(false);
            }}
          />
        ) : null}
      </BottomSheet>
      {deleteCategory.sheet}
    </Screen>
  );
}
