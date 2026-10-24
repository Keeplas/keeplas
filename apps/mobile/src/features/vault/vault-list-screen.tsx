import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { Icon } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { NavBar } from "@/components/nav-bar";
import { Chip } from "@/components/rows";
import { Screen } from "@/components/screen";
import { StateMessage } from "@/components/state-message";
import { ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useOpenAddSheet } from "@/features/capture/add-sheet";
import {
  inVaultList,
  listCounts,
  presetCategory,
  VAULT_LISTS,
  type VaultListKey,
} from "@/features/home/vault-groups";
import { useCategoryLabel } from "@/features/vault/category-sheet";
import { ItemActionsSheet } from "@/features/vault/item-actions-sheet";
import { accessIcon, itemVisual, styleOf } from "@/features/vault/item-visual";
import { VaultListRow } from "@/features/vault/vault-list-row";
import {
  useVaultData,
  type VaultItemSummary,
} from "@/features/vault/vault-data";
import { formatDuration, relativeDay } from "@/lib/format";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius, singleLine, type } from "@/theme";

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

/**
 * M10-1 vault list: search, list chips and the items of one list. The Vault
 * tab shows it on "all"; Home tiles open it on their group, with a back.
 */
export function VaultListScreen({
  initial,
  onBack,
}: {
  initial: VaultListKey;
  onBack?: () => void;
}) {
  const { t } = useI18n();
  const categoryLabel = useCategoryLabel();
  const { colors } = useTheme();
  const openAdd = useOpenAddSheet();
  const { items, pending } = useVaultData();
  const [actionsFor, setActionsFor] = useState<Id<"vault_items"> | null>(null);
  const [list, setList] = useState<VaultListKey>(initial);
  const [term, setTerm] = useState("");
  const chipsRef = useRef<ScrollView>(null);
  const chipsRow = useRef<{
    viewport: number;
    content: number;
    frames: Partial<Record<VaultListKey, { x: number; width: number }>>;
  }>({ viewport: 0, content: 0, frames: {} });
  const centerChip = useCallback((key: VaultListKey, animated: boolean) => {
    const { viewport, content, frames } = chipsRow.current;
    const frame = frames[key];
    if (!frame || !viewport) return;
    const centered = frame.x + frame.width / 2 - viewport / 2;
    const max = Math.max(0, content - viewport);
    chipsRef.current?.scrollTo({
      x: Math.min(max, Math.max(0, centered)),
      animated,
    });
  }, []);

  useEffect(() => {
    centerChip(list, true);
  }, [list, centerChip]);
  const needle = useDeferredValue(term.trim().toLocaleLowerCase());

  const counts = useMemo(() => listCounts(items ?? []), [items]);
  const listItems = useMemo(
    () =>
      (items ?? []).filter(
        (item) =>
          inVaultList(item, list) &&
          (!needle || item.title?.toLocaleLowerCase().includes(needle)),
      ),
    [items, list, needle],
  );
  const listPending =
    !needle && (list === "inbox" || list === "all") ? pending : [];
  const count = listItems.length + listPending.length;
  const chips = VAULT_LISTS.filter(
    (key) => key === "all" || key === list || counts[key] > 0,
  );

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
    <Screen
      header={
        <NavBar
          title={t(TITLE_KEY[list])}
          onBack={onBack}
          right={<LanguageDropdown />}
        />
      }
      scroll={false}
    >
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
                  placeholder={t("vaultList.search")}
                  placeholderTextColor={colors["text.subtle"]}
                  accessibilityLabel={t("vaultList.search")}
                  returnKeyType="search"
                  style={[
                    singleLine(type.body),
                    styles.input,
                    { color: colors["text.primary"] },
                  ]}
                />
              </View>
              <ScrollView
                ref={chipsRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
                onLayout={(event) => {
                  chipsRow.current.viewport = event.nativeEvent.layout.width;
                  centerChip(list, false);
                }}
                onContentSizeChange={(width) => {
                  chipsRow.current.content = width;
                  centerChip(list, false);
                }}
              >
                {chips.map((key) => (
                  <View
                    key={key}
                    onLayout={(event) => {
                      chipsRow.current.frames[key] = event.nativeEvent.layout;
                      if (key === list) centerChip(key, false);
                    }}
                  >
                    <Chip
                      label={
                        key === "all"
                          ? t("vaultList.chipAll")
                          : t(TITLE_KEY[key])
                      }
                      count={key === "all" ? undefined : counts[key]}
                      selected={key === list}
                      onPress={() => setList(key)}
                    />
                  </View>
                ))}
              </ScrollView>
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
                  icon={list === "inbox" ? "mail" : "folder"}
                  tone="info"
                  title={t(
                    items.length
                      ? "vaultList.groupEmptyTitle"
                      : "vaultList.emptyTitle",
                  )}
                  body={t("vaultList.emptyBody")}
                  primary={{
                    label: t("vaultList.addItem"),
                    onPress: () => openAdd({ category: presetCategory(list) }),
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
    </Screen>
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
  chips: { gap: 8 },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  empty: { flex: 1, justifyContent: "center" },
});
