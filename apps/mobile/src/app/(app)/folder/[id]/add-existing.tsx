import { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { Button } from "@/components/button";
import { Checkbox } from "@/components/controls";
import { Icon } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useCategoryLabel } from "@/features/vault/category-sheet";
import { useMoveToFolder } from "@/features/vault/use-move-to-folder";
import {
  useVaultData,
  type VaultItemSummary,
} from "@/features/vault/vault-data";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius, singleLine, type } from "@/theme";

export default function AddExistingItems() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const folderId = id as Id<"folders">;
  const router = useRouter();
  const { t } = useI18n();
  const categoryLabel = useCategoryLabel();
  const { colors } = useTheme();
  const { items, folders } = useVaultData();
  const rawItems = useQuery(api.vault_items.getItemSummaries);
  const moveToFolder = useMoveToFolder();
  const folder = folders?.find((row) => row.id === id);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return (items ?? []).filter(
      (item) =>
        item.folderId !== id &&
        (!needle || item.title?.toLocaleLowerCase().includes(needle)),
    );
  }, [items, id, search]);

  const toggle = useCallback((itemId: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  async function add() {
    setBusy(true);
    setError(null);
    for (const itemId of selected) {
      const raw = rawItems?.find((item) => item._id === itemId);
      const title = items?.find((item) => item.id === itemId)?.title;
      if (!raw) continue;
      try {
        await moveToFolder(raw, folderId);
      } catch {
        setBusy(false);
        return setError(
          t("folders.addExistingFailed", {
            name: title ?? t("capture.untitled"),
          }),
        );
      }
    }
    setBusy(false);
    router.back();
  }

  const renderItem = useCallback(
    ({ item }: { item: VaultItemSummary }) => (
      <Checkbox
        checked={selected.has(item.id)}
        onChange={(checked) => toggle(item.id, checked)}
        label={item.title ?? t("item.decrypting")}
        description={
          item.folderId
            ? t("folders.currentlyIn", {
                name:
                  folders?.find((row) => row.id === item.folderId)?.name ??
                  t("folders.title"),
              })
            : categoryLabel(item)
        }
      />
    ),
    [selected, toggle, t, folders, categoryLabel],
  );

  return (
    <Screen
      header={
        <NavBar
          title={t("folders.addExisting")}
          onBack={router.back}
          right={<LanguageDropdown />}
        />
      }
      scroll={false}
      footer={
        <View style={styles.footer}>
          {error ? (
            <Text variant="body-sm" color="status.revoked" align="center">
              {error}
            </Text>
          ) : folder?.grants.length ? (
            <Text variant="body-sm" color="text.muted" align="center">
              {t("folders.addExistingShared", {
                people: folder.grants.map((g) => g.contactName).join(", "),
              })}
            </Text>
          ) : null}
          <Button
            label={
              selected.size
                ? t("folders.addSelected", { n: selected.size })
                : t("folders.addExisting")
            }
            onPress={() => void add()}
            loading={busy}
            disabled={selected.size === 0}
          />
        </View>
      }
    >
      <FlatList
        data={candidates}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="h1">{t("folders.addExisting")}</Text>
            <Text variant="body-lg" color="text.muted">
              {t("folders.addExistingBody", {
                name: folder?.name ?? t("folders.title"),
              })}
            </Text>
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
                value={search}
                onChangeText={setSearch}
                placeholder={t("vaultList.search")}
                placeholderTextColor={colors["text.subtle"]}
                accessibilityLabel={t("vaultList.search")}
                style={[
                  singleLine(type.body),
                  styles.input,
                  { color: colors["text.primary"] },
                ]}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text variant="body-sm" color="text.muted">
            {search ? t("vaultList.noResults") : t("folders.nothingToAdd")}
          </Text>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 8 },
  list: { gap: 16, paddingBottom: 24 },
  header: { gap: 14, paddingBottom: 6 },
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
});
