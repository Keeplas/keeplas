import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { FlatList } from "react-native";
import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { TextField } from "@/components/text-field";
import { Text } from "@/components/text";
import { VaultItemRow } from "@/features/vault/item-row";
import {
  useVaultData,
  type VaultItemSummary,
} from "@/features/vault/vault-data";
import { useI18n } from "@/providers/i18n-provider";

/** Local-only search over decrypted in-memory titles. */
export default function Search() {
  const { t } = useI18n();
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
        description={t(`capture.category.${item.category}`)}
      />
    ),
    [t],
  );

  return (
    <Screen header={<AppHeader />} scroll={false}>
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
