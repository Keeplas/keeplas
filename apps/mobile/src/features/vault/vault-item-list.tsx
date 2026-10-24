import {
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { FlatList, StyleSheet, TextInput, View } from "react-native";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { Icon } from "@/components/icon";
import { StateMessage } from "@/components/state-message";
import { ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useOpenAddSheet } from "@/features/capture/add-sheet";
import {
  isVaultListKey,
  type VaultListKey,
} from "@/features/home/vault-groups";
import { formatDuration, relativeDay } from "@/lib/format";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius, singleLine, type } from "@/theme";
import { useCategoryLabel } from "./category-sheet";
import { ItemActionsSheet } from "./item-actions-sheet";
import { accessIcon, itemVisual, styleOf } from "./item-visual";
import { useVaultData, type VaultItemSummary } from "./vault-data";
import { filterPreset, inFilter } from "./vault-filter";
import { VaultListRow } from "./vault-list-row";

const TITLE_KEY: Record<VaultListKey, string> = {
  all: "vaultList.all",
  documents: "home.documents",
  accounts: "home.accounts",
  instructions: "home.instructions",
  notes: "vaultList.notes",
  photos: "vaultList.photos",
  voice: "vaultList.voice",
  videos: "vaultList.videos",
  other: "home.other",
  inbox: "home.inbox",
};

/** Title of a vault filter: a built-in list, or one of your categories. */
export function useFilterTitle() {
  const { t } = useI18n();
  const { categories } = useVaultData();
  return useCallback(
    (filter: string) =>
      isVaultListKey(filter)
        ? t(TITLE_KEY[filter])
        : (categories?.find((category) => category.id === filter)?.name ??
          t("item.decrypting")),
    [t, categories],
  );
}

/**
 * M10-1 list of the Vault tab and the category pages: search, the items of
 * one filter with their details, and the empty state.
 */
export function VaultItemList({
  filter,
  searchLabel,
  header,
}: {
  /** A built-in list key or a user-made category id (see vault-filter). */
  filter: string;
  searchLabel: string;
  /** Under the search field (the Vault tab's chips). */
  header?: ReactNode;
}) {
  const { t } = useI18n();
  const categoryLabel = useCategoryLabel();
  const { colors } = useTheme();
  const openAdd = useOpenAddSheet();
  const { items, pending } = useVaultData();
  const [actionsFor, setActionsFor] = useState<Id<"vault_items"> | null>(null);
  const [term, setTerm] = useState("");
  const needle = useDeferredValue(term.trim().toLocaleLowerCase());

  const listItems = useMemo(
    () =>
      (items ?? []).filter(
        (item) =>
          inFilter(item, filter) &&
          (!needle || item.title?.toLocaleLowerCase().includes(needle)),
      ),
    [items, filter, needle],
  );
  const listPending =
    !needle && (filter === "inbox" || filter === "all") ? pending : [];
  const count = listItems.length + listPending.length;

  const subtitle = useCallback(
    (item: VaultItemSummary) => {
      const when = relativeDay(item.updatedAt);
      const ago = t(`vaultList.time.${when.key}`, { n: when.n });
      const length = item.durationSec ? formatDuration(item.durationSec) : ago;
      switch (styleOf(item)) {
        case "documents":
          return `${categoryLabel(item)} · ${ago}`;
        case "accounts":
          return `${t("home.accounts")} · ${ago}`;
        case "instructions":
          return `${t("home.instructions")} · ${ago}`;
        case "notes":
          return `${t("vaultList.note")} · ${
            item.attachments === 0
              ? ago
              : item.attachments === 1
                ? t("vaultList.attachment")
                : t("vaultList.attachments", { n: item.attachments })
          }`;
        case "photos":
          return `${t("vaultList.photo")} · ${ago}`;
        case "voice":
          return `${t("vaultList.voiceNote")} · ${length}`;
        case "videos":
          return `${t("vaultList.video")} · ${length}`;
      }
    },
    [t, categoryLabel],
  );

  const openActions = useCallback(
    (id: string) => setActionsFor(id as Id<"vault_items">),
    [],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: VaultItemSummary; index: number }) => {
      const visual = itemVisual(item);
      return (
        <VaultListRow
          id={item.id}
          title={item.title ?? t("item.decrypting")}
          subtitle={subtitle(item)}
          icon={visual.icon}
          color={visual.color}
          access={accessIcon(item)}
          onMore={openActions}
          first={index === 0}
          last={index === listItems.length - 1}
        />
      );
    },
    [t, subtitle, listItems.length, openActions],
  );

  return (
    <>
      <View style={styles.flex}>
        <FlatList
          data={listItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={10}
          windowSize={5}
          ListHeaderComponentStyle={styles.header}
          ListHeaderComponent={
            <>
              <View
                style={[
                  styles.search,
                  {
                    backgroundColor: colors["bg.surface"],
                    borderColor: colors["border.default"],
                  },
                ]}
              >
                <Icon name="search" size={18} color="text.muted" />
                <TextInput
                  value={term}
                  onChangeText={setTerm}
                  placeholder={searchLabel}
                  placeholderTextColor={colors["text.subtle"]}
                  accessibilityLabel={searchLabel}
                  returnKeyType="search"
                  style={[
                    singleLine(type.body),
                    styles.input,
                    { color: colors["text.primary"] },
                  ]}
                />
              </View>
              {header}
              {count ? (
                <View style={styles.listHeader}>
                  <Text variant="label">
                    {count === 1 ? t("home.item") : t("home.items", { count })}
                  </Text>
                  <Text variant="body-sm" color="text.muted">
                    {t("vaultList.lastUpdated")}
                  </Text>
                </View>
              ) : null}
              {listPending.map(({ entry, title: pendingTitle }) => (
                <ListRow
                  key={entry.id}
                  icon="cloud-upload"
                  title={pendingTitle ?? t("capture.untitled")}
                  description={t(`home.outbox.${entry.status}`)}
                />
              ))}
            </>
          }
          ListEmptyComponent={
            !items || listPending.length ? null : needle ? (
              <Text color="text.muted">{t("vaultList.noResults")}</Text>
            ) : (
              <View style={styles.empty}>
                <StateMessage
                  icon={filter === "inbox" ? "mail" : "folder"}
                  tone="info"
                  title={t(
                    items.length
                      ? "vaultList.groupEmptyTitle"
                      : "vaultList.emptyTitle",
                  )}
                  body={t("vaultList.emptyBody")}
                  primary={{
                    label: t("vaultList.addItem"),
                    onPress: () => openAdd(filterPreset(filter)),
                  }}
                />
              </View>
            )
          }
        />
      </View>
      <ItemActionsSheet
        itemId={actionsFor}
        onDismiss={() => setActionsFor(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: { flexGrow: 1, paddingBottom: 24 },
  header: { gap: 14, paddingBottom: 14 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  input: { flex: 1, paddingVertical: 0 },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  empty: { flex: 1, justifyContent: "center" },
});
