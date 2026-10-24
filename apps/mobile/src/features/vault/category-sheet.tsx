import { useCallback, useState } from "react";
import { api } from "@keeplas/backend/_generated/api";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { BottomSheet } from "@/components/sheet";
import { ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { encryptText } from "@/crypto/envelope";
import { CUSTOM_FALLBACK, type CategoryChoice } from "@/crypto/item-meta";
import { GROUP_CATEGORY } from "@/features/home/vault-groups";
import { useVaultData } from "@/features/vault/vault-data";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useVault } from "@/providers/vault-provider";

const BUILT_IN = Object.values(GROUP_CATEGORY);

/** Display name of where an item is filed (user-made name, else built-in). */
export function useCategoryLabel() {
  const { t } = useI18n();
  const { categories } = useVaultData();
  return useCallback(
    ({ category, categoryId }: CategoryChoice) =>
      (categoryId && categories?.find((c) => c.id === categoryId)?.name) ||
      t(`capture.category.${category}`),
    [categories, t],
  );
}

/**
 * Category picker of capture and item details: the built-in categories, the
 * owner's own ones, and a row to add a new one (name sealed under the master
 * key before it leaves the phone).
 */
export function CategorySheet({
  visible,
  value,
  onChange,
  onDismiss,
}: {
  visible: boolean;
  value: CategoryChoice;
  onChange: (choice: CategoryChoice) => void;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const { masterKey } = useVault();
  const { categories } = useVaultData();
  const create = useAuditedMutation(api.vault_categories.create);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function close() {
    setNaming(false);
    setName("");
    setFailed(false);
    onDismiss();
  }

  function choose(choice: CategoryChoice) {
    onChange(choice);
    close();
  }

  async function add() {
    if (!masterKey) return;
    setBusy(true);
    setFailed(false);
    try {
      const categoryId = await create({
        encryptedName: await encryptText(name.trim(), masterKey),
      });
      choose({ category: CUSTOM_FALLBACK, categoryId });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const check = <Icon name="check" size={18} color="status.active" />;

  return (
    <BottomSheet
      visible={visible}
      onDismiss={close}
      title={naming ? t("categories.new") : t("capture.categoryLabel")}
    >
      {naming ? (
        <>
          <TextField
            label={t("categories.name")}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => name.trim() && void add()}
          />
          <Text variant="body-sm" color="text.muted">
            {t("categories.newBody")}
          </Text>
          {failed ? (
            <Text variant="body-sm" color="status.revoked">
              {t("common.genericError")}
            </Text>
          ) : null}
          <Button
            label={t("categories.create")}
            loading={busy}
            disabled={!name.trim()}
            onPress={() => void add()}
          />
        </>
      ) : (
        <>
          {BUILT_IN.map((category) => (
            <ListRow
              key={category}
              icon="document"
              title={t(`capture.category.${category}`)}
              trailing={
                !value.categoryId && value.category === category
                  ? check
                  : undefined
              }
              onPress={() => choose({ category })}
            />
          ))}
          {(categories ?? []).map((category) => (
            <ListRow
              key={category.id}
              icon="document"
              title={category.name ?? t("item.decrypting")}
              trailing={value.categoryId === category.id ? check : undefined}
              onPress={() =>
                choose({ category: CUSTOM_FALLBACK, categoryId: category.id })
              }
            />
          ))}
          <ListRow
            icon="plus"
            title={t("categories.new")}
            onPress={() => setNaming(true)}
          />
        </>
      )}
    </BottomSheet>
  );
}
