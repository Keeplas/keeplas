import { useCallback, useMemo } from "react";
import { FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { CUSTOM_FALLBACK } from "@/crypto/item-meta";
import { useOpenAddSheet } from "@/features/capture/add-sheet";
import { VaultItemRow } from "@/features/vault/item-row";
import { itemVisual } from "@/features/vault/item-visual";
import {
  useVaultData,
  type VaultItemSummary,
} from "@/features/vault/vault-data";
import { useI18n } from "@/providers/i18n-provider";

/** Items filed under one user-made category. */
export default function CategoryDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { categories, items } = useVaultData();
  const openAdd = useOpenAddSheet();
  const name =
    categories?.find((row) => row.id === id)?.name ?? t("item.decrypting");
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
          </>
        }
        ListHeaderComponentStyle={{ gap: 16 }}
      />
    </Screen>
  );
}
