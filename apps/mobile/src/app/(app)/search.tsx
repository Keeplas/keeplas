import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { FlatList } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { TextField } from "@/components/text-field";
import { Text } from "@/components/text";
import { useCategoryLabel } from "@/features/vault/category-sheet";
import { VaultItemRow } from "@/features/vault/item-row";
import {
  useVaultData,
  type VaultItemSummary,
} from "@/features/vault/vault-data";
import { useI18n } from "@/providers/i18n-provider";

/** Local-only search over decrypted in-memory titles (from the Home header). */
export default function Search() {
  const router = useRouter();
  const { t } = useI18n();
  const categoryLabel = useCategoryLabel();
  const { items } = useVaultData();
  const [term, setTerm] = useState("");
  // Defer filtering so keystrokes stay responsive on large vaults.
  const needle = useDeferredValue(term.trim().toLocaleLowerCase());
  const results = useMemo(
    () =>
      (items ?? []).filter(
        (item) => !needle || item.title?.toLocaleLowerCase().includes(needle),
      ),
    [items, needle],
  );

  const renderItem = useCallback(
    ({ item }: { item: VaultItemSummary }) => (
      <VaultItemRow
        id={item.id}
        title={item.title ?? t("item.decrypting")}
        description={categoryLabel(item)}
      />
    ),
    [t, categoryLabel],
  );

  return (
    <Screen header={<AppHeader onBack={router.back} />} scroll={false}>
      <Text variant="h1">{t("nav.search")}</Text>
      <TextField
        label={t("search.label")}
        placeholder={t("search.placeholder")}
        value={term}
        onChangeText={setTerm}
        autoFocus
      />
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        windowSize={5}
        ListEmptyComponent={
          needle ? <Text color="text.muted">{t("search.empty")}</Text> : null
        }
      />
    </Screen>
  );
}
