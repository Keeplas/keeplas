import { useMemo, useState } from "react";
import { Alert, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { NavBar } from "@/components/nav-bar";
import { SectionHeader } from "@/components/rows";
import { Screen } from "@/components/screen";
import { BottomSheet } from "@/components/sheet";
import { ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import {
  GROUP_CATEGORY,
  VAULT_GROUPS,
  type VaultGroupKey,
} from "@/features/home/vault-groups";
import { NewCategoryForm } from "@/features/vault/category-sheet";
import { useVaultData } from "@/features/vault/vault-data";
import { categoryCounts } from "@/features/vault/vault-filter";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";

/**
 * Settings → Categories: delete built-in categories (restorable) and add or
 * delete your own. Items of a deleted category show in the Inbox, which
 * always stays.
 */
export default function Categories() {
  const router = useRouter();
  const { t } = useI18n();
  const { categories, items } = useVaultData();
  const hidden = useViewer().hiddenCategoryGroups ?? [];
  const setHidden = useAuditedMutation(api.users.setHiddenCategoryGroups);
  const removeCategory = useAuditedMutation(api.vault_categories.remove);
  const [adding, setAdding] = useState(false);
  const byCategory = useMemo(() => categoryCounts(items ?? []), [items]);

  const builtInLabel = (key: VaultGroupKey) =>
    t(`capture.category.${GROUP_CATEGORY[key]}`);
  const failed = () =>
    toast({ variant: "error", title: t("common.genericError") });

  function confirmDelete(name: string, run: () => Promise<unknown>) {
    Alert.alert(
      t("categories.deleteTitle", { name }),
      t("categories.deleteBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("categories.delete"),
          style: "destructive",
          onPress: () => void run().catch(failed),
        },
      ],
    );
  }

  const trash = (name: string, run: () => Promise<unknown>) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("categories.deleteTitle", { name })}
      hitSlop={10}
      onPress={() => confirmDelete(name, run)}
    >
      <Icon name="trash" size={18} color="text.muted" />
    </Pressable>
  );

  return (
    <Screen
      header={
        <NavBar
          title={t("categories.title")}
          onBack={router.back}
          right={<LanguageDropdown />}
        />
      }
      gap={12}
    >
      <Text color="text.muted">{t("categories.body")}</Text>
      <ListRow
        icon="mail"
        title={t("capture.category.inbox")}
        description={t("categories.inboxBody")}
      />
      {VAULT_GROUPS.filter((group) => !hidden.includes(group.key)).map(
        (group) => (
          <ListRow
            key={group.key}
            icon={group.icon}
            title={builtInLabel(group.key)}
            trailing={trash(builtInLabel(group.key), () =>
              setHidden({ groups: [...hidden, group.key] }),
            )}
          />
        ),
      )}
      {(categories ?? []).map((category) => {
        const name = category.name ?? t("item.decrypting");
        const count = byCategory.get(category.id) ?? 0;
        return (
          <ListRow
            key={category.id}
            icon="document"
            title={name}
            description={t("categories.items", { n: count })}
            trailing={trash(name, () =>
              removeCategory({ categoryId: category.id }),
            )}
          />
        );
      })}
      <Button
        variant="secondary"
        label={t("categories.new")}
        onPress={() => setAdding(true)}
      />
      {hidden.length ? (
        <>
          <SectionHeader title={t("categories.removed")} />
          {hidden.map((key) => (
            <ListRow
              key={key}
              icon="rotate"
              title={builtInLabel(key)}
              description={t("categories.restore")}
              onPress={() =>
                void setHidden({
                  groups: hidden.filter((group) => group !== key),
                }).catch(failed)
              }
            />
          ))}
        </>
      ) : null}
      <BottomSheet
        visible={adding}
        onDismiss={() => setAdding(false)}
        title={t("categories.new")}
      >
        <NewCategoryForm onCreated={() => setAdding(false)} />
      </BottomSheet>
    </Screen>
  );
}
