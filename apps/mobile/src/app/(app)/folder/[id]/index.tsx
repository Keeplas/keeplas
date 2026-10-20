import { useCallback, useMemo } from "react";
import { FlatList, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useOpenAddSheet } from "@/features/capture/add-sheet";
import { VaultItemRow } from "@/features/vault/item-row";
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
      <VaultItemRow id={item.id} title={item.title ?? t("item.decrypting")} />
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
              label={t("folders.share")}
              onPress={() =>
                router.push({ pathname: "/folder/[id]/share", params: { id } })
              }
            />
          </>
        }
        ListHeaderComponentStyle={{ gap: 16 }}
        ListFooterComponent={
          <View style={{ gap: 16 }}>
            {(folder?.grants ?? []).map((grant) => (
              <ListRow
                key={grant.grantId}
                icon="user-circle"
                title={grant.contactName}
                description={t(`folders.timing.${grant.timing}`)}
              />
            ))}
          </View>
        }
      />
    </Screen>
  );
}
