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
 * Name field of a user-made category. The name is sealed under the master
 * key before it leaves the phone; `onSubmit` gets the ciphertext.
 */
export function CategoryNameForm({
  initial = "",
  submitLabel,
  onSubmit,
}: {
  initial?: string;
  submitLabel: string;
  onSubmit: (encryptedName: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const { masterKey } = useVault();
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit() {
    if (!masterKey) return;
    setBusy(true);
    setFailed(false);
    try {
      await onSubmit(await encryptText(name.trim(), masterKey));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TextField
        label={t("categories.name")}
        value={name}
        onChangeText={setName}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => name.trim() && void submit()}
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
        label={submitLabel}
        loading={busy}
        disabled={!name.trim()}
        onPress={() => void submit()}
      />
    </>
  );
}

/**
 * Category picker of capture and item details: the built-in categories, the
 * owner's own ones, and a row to add a new one.
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
  const { categories } = useVaultData();
  const create = useAuditedMutation(api.vault_categories.create);
  const [naming, setNaming] = useState(false);

  function close() {
    setNaming(false);
    onDismiss();
  }

  function choose(choice: CategoryChoice) {
    onChange(choice);
    close();
  }

  const check = <Icon name="check" size={18} color="status.active" />;
  // A deleted category leaves its id in the item: show the fallback checked.
  const customId = categories?.some((c) => c.id === value.categoryId)
    ? value.categoryId
    : undefined;

  return (
    <BottomSheet
      visible={visible}
      onDismiss={close}
      title={naming ? t("categories.new") : t("capture.categoryLabel")}
    >
      {naming ? (
        <CategoryNameForm
          submitLabel={t("categories.create")}
          onSubmit={async (encryptedName) => {
            const categoryId = await create({ encryptedName });
            choose({ category: CUSTOM_FALLBACK, categoryId });
          }}
        />
      ) : (
        <>
          {BUILT_IN.map((category) => (
            <ListRow
              key={category}
              icon="document"
              title={t(`capture.category.${category}`)}
              trailing={
                !customId && value.category === category ? check : undefined
              }
              onPress={() => choose({ category })}
            />
          ))}
          {(categories ?? []).map((category) => (
            <ListRow
              key={category.id}
              icon="document"
              title={category.name ?? t("item.decrypting")}
              trailing={customId === category.id ? check : undefined}
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
