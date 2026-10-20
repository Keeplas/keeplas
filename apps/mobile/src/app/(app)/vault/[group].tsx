import { useCallback, useMemo } from "react";
import { FlatList, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { StateMessage } from "@/components/state-message";
import { ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useOpenAddSheet } from "@/features/capture/add-sheet";
import {
  inVaultList,
  isVaultListKey,
  type VaultListKey,
} from "@/features/home/vault-groups";
import { VaultItemRow } from "@/features/vault/item-row";
import {
  useVaultData,
  type VaultItemSummary,
} from "@/features/vault/vault-data";
import { useI18n } from "@/providers/i18n-provider";

const TITLE_KEY: Record<VaultListKey, string> = {
  documents: "home.documents",
  accounts: "home.accounts",
  instructions: "home.instructions",
  other: "home.other",
  inbox: "home.inbox",
  all: "vaultList.all",
};

export default function VaultList() {
  const { group = "" } = useLocalSearchParams<{ group: string }>();
  const list: VaultListKey = isVaultListKey(group) ? group : "all";
  const router = useRouter();
  const { t } = useI18n();
  const openAdd = useOpenAddSheet();
  const { items, pending } = useVaultData();
  const title = t(TITLE_KEY[list]);

  const listItems = useMemo(
    () => (items ?? []).filter((item) => inVaultList(item.category, list)),
    [items, list],
  );
  const listPending = list === "inbox" || list === "all" ? pending : [];
  const count = listItems.length + listPending.length;

  const renderItem = useCallback(
    ({ item }: { item: VaultItemSummary }) => (
      <VaultItemRow
        id={item.id}
        title={item.title ?? t("item.decrypting")}
        description={t(`capture.category.${item.category}`)}
      />
    ),
    [t],
  );

  return (
    <Screen
      header={<NavBar title={title} onBack={router.back} />}
      scroll={false}
    >
      <FlatList
        data={listItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ gap: 16, paddingBottom: 24, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        windowSize={5}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <Text variant="h1">{title}</Text>
            {count ? (
              <Text color="text.muted">
                {count === 1 ? t("home.item") : t("home.items", { count })}
              </Text>
            ) : null}
            {listPending.map(({ entry, title: pendingTitle }) => (
              <ListRow
                key={entry.id}
                icon="cloud-upload"
                title={pendingTitle ?? t("capture.untitled")}
                description={t(`home.outbox.${entry.status}`)}
              />
            ))}
          </View>
        }
        ListEmptyComponent={
          items && !listPending.length ? (
            <View style={{ flex: 1, justifyContent: "center" }}>
              <StateMessage
                icon={list === "inbox" ? "mail" : "folder"}
                tone="info"
                title={t(
                  items.length
                    ? "vaultList.groupEmptyTitle"
                    : "vaultList.emptyTitle",
                )}
                body={t("vaultList.emptyBody")}
                primary={{ label: t("vaultList.addItem"), onPress: openAdd }}
              />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}
