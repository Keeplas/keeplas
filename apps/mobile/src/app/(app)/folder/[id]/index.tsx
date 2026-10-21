import { useCallback, useMemo } from "react";
import { FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useOpenAddSheet } from "@/features/capture/add-sheet";
import { VaultItemRow } from "@/features/vault/item-row";
import { itemVisual } from "@/features/vault/item-visual";
import {
  useVaultData,
  type VaultItemSummary,
} from "@/features/vault/vault-data";
import { useI18n } from "@/providers/i18n-provider";

export default function FolderDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { folders, items } = useVaultData();
  const openAdd = useOpenAddSheet();
  const folder = folders?.find((row) => row.id === id);
  const folderItems = useMemo(
    () => items?.filter((item) => item.folderId === id) ?? [],
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
      header={
        <NavBar
          title={folder?.name ?? t("folders.title")}
          onBack={router.back}
        />
      }
      scroll={false}
    >
      <FlatList
        data={folderItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        windowSize={5}
        ListHeaderComponent={
          <>
            <Text variant="h1">{folder?.name ?? t("folders.title")}</Text>
            <Text color="text.muted">
              {t("folders.items", { n: folderItems.length })}
            </Text>
            <Button
              label={t("vaultList.addItem")}
              onPress={() => openAdd({ folderId: id })}
            />
            <Button
              variant="secondary"
              label={t("folders.addExisting")}
              onPress={() =>
                router.push({
                  pathname: "/folder/[id]/add-existing",
                  params: { id },
                })
              }
            />
            <ListRow
              icon="people"
              title={t("folders.accessTitle")}
              description={
                folder?.grants.length
                  ? folder.grants.map((g) => g.contactName).join(", ")
                  : t("item.onlyYou")
              }
              onPress={() =>
                router.push({ pathname: "/folder/[id]/access", params: { id } })
              }
            />
          </>
        }
        ListHeaderComponentStyle={{ gap: 16 }}
      />
    </Screen>
  );
}
