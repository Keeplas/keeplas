import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { LanguageDropdown } from "@/components/language";
import { NavBar } from "@/components/nav-bar";
import { Chip } from "@/components/rows";
import { Screen } from "@/components/screen";
import {
  isVaultListKey,
  listCounts,
  VAULT_LISTS,
  type VaultListKey,
} from "@/features/home/vault-groups";
import { useI18n } from "@/providers/i18n-provider";
import { useVaultData } from "./vault-data";
import { categoryCounts } from "./vault-filter";
import { useFilterTitle, VaultItemList } from "./vault-item-list";
import { VaultSwitch } from "./vault-switch";

/**
 * M10-1 vault list: search, filter chips and the items of one filter. The
 * Vault tab shows it on "all"; "See all" on Home opens it with a back.
 */
export function VaultListScreen({
  initial,
  onBack,
}: {
  initial: VaultListKey;
  onBack?: () => void;
}) {
  const { t } = useI18n();
  const { categories } = useVaultData();
  const title = useFilterTitle();
  const [selected, setSelected] = useState<string>(initial);
  // Back to all items once the category of yours it shows is deleted.
  const filter =
    isVaultListKey(selected) ||
    categories?.some((category) => category.id === selected)
      ? selected
      : "all";

  return (
    <Screen
      header={
        <NavBar
          title={title(filter)}
          onBack={onBack}
          right={<LanguageDropdown />}
        />
      }
      scroll={false}
    >
      {filter === "all" ? <VaultSwitch active="mine" /> : null}
      <VaultItemList
        filter={filter}
        searchLabel={t("vaultList.search")}
        header={<FilterChips filter={filter} onSelect={setSelected} />}
      />
    </Screen>
  );
}

/**
 * The built-in lists, then your categories before To sort; a filter with
 * nothing in it shows only while selected.
 */
function FilterChips({
  filter,
  onSelect,
}: {
  filter: string;
  onSelect: (filter: string) => void;
}) {
  const { t } = useI18n();
  const title = useFilterTitle();
  const { items, categories } = useVaultData();
  const counts = useMemo(() => listCounts(items ?? []), [items]);
  const byCategory = useMemo(() => categoryCounts(items ?? []), [items]);
  const chipsRef = useRef<ScrollView>(null);
  const chipsRow = useRef<{
    viewport: number;
    content: number;
    frames: Record<string, { x: number; width: number }>;
  }>({ viewport: 0, content: 0, frames: {} });
  const centerChip = useCallback((key: string, animated: boolean) => {
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
    centerChip(filter, true);
  }, [filter, centerChip]);

  const countOf = (key: string) =>
    isVaultListKey(key) ? counts[key] : (byCategory.get(key) ?? 0);
  const inbox = VAULT_LISTS.indexOf("inbox");
  const chips = [
    ...VAULT_LISTS.slice(0, inbox),
    ...(categories ?? []).map((category) => category.id),
    ...VAULT_LISTS.slice(inbox),
  ].filter((key) => key === "all" || key === filter || countOf(key) > 0);

  return (
    <ScrollView
      ref={chipsRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      onLayout={(event) => {
        chipsRow.current.viewport = event.nativeEvent.layout.width;
        centerChip(filter, false);
      }}
      onContentSizeChange={(width) => {
        chipsRow.current.content = width;
        centerChip(filter, false);
      }}
    >
      {chips.map((key) => (
        <View
          key={key}
          onLayout={(event) => {
            chipsRow.current.frames[key] = event.nativeEvent.layout;
            if (key === filter) centerChip(key, false);
          }}
        >
          <Chip
            label={key === "all" ? t("vaultList.chipAll") : title(key)}
            count={key === "all" ? undefined : countOf(key)}
            selected={key === filter}
            onPress={() => onSelect(key)}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8 },
});
