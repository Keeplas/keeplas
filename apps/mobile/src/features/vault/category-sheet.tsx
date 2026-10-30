import { useCallback, useMemo, useState } from "react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { Button } from "@/components/button";
import { ErrorText } from "@/components/error-text";
import { BottomSheet } from "@/components/sheet";
import { ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { encryptText } from "@/crypto/envelope";
import {
  CUSTOM_FALLBACK,
  itemMetaJson,
  type CategoryChoice,
} from "@/crypto/item-meta";
import {
  builtInCategory,
  GROUP_CATEGORY,
  groupOf,
  shownFiling,
} from "@/features/home/vault-groups";
import { useVaultData } from "@/features/vault/vault-data";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";

/**
 * Where an item shows: in the Inbox once its category was deleted in
 * Settings → Categories.
 */
function useShownFiling() {
  const { categories } = useVaultData();
  const hidden = useViewer().hiddenCategoryGroups;
  return useCallback(
    (choice: CategoryChoice) =>
      shownFiling(
        choice,
        hidden ?? [],
        categories?.map((category) => category.id as string),
      ),
    [categories, hidden],
  );
}

/** Display name of where an item is filed (user-made name, else built-in). */
export function useCategoryLabel() {
  const { t } = useI18n();
  const { categories } = useVaultData();
  const shown = useShownFiling();
  return useCallback(
    (choice: CategoryChoice) => {
      const { category, categoryId } = shown(choice);
      return (
        (categoryId && categories?.find((c) => c.id === categoryId)?.name) ||
        t(`capture.category.${builtInCategory(category)}`)
      );
    },
    [categories, shown, t],
  );
}

/** Built-in categories the user kept (the Inbox always stays). */
export function useBuiltInCategories() {
  const hidden = useViewer().hiddenCategoryGroups;
  return useMemo(
    () =>
      Object.values(GROUP_CATEGORY).filter((category) => {
        const group = groupOf(category);
        return !group || !hidden?.includes(group);
      }),
    [hidden],
  );
}

/** Re-seal a saved item's metadata under another category. */
export function useRecategorize() {
  const { itemKey } = useVaultData();
  const updateItem = useAuditedMutation(api.vault_items.updateItem);
  return useCallback(
    async (
      item: { _id: Id<"vault_items">; ownerWrappedDek?: string },
      current: CategoryChoice & { icon?: string },
      choice: CategoryChoice,
    ) => {
      if (
        choice.category === current.category &&
        choice.categoryId === current.categoryId
      )
        return;
      await updateItem({
        itemId: item._id,
        encryptedMeta: await encryptText(
          itemMetaJson(choice, current.icon),
          await itemKey(item),
        ),
      });
    },
    [itemKey, updateItem],
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
    if (!masterKey || !name.trim()) return;
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
        onSubmitEditing={() => void submit()}
      />
      <Text variant="body-sm" color="text.muted">
        {t("categories.newBody")}
      </Text>
      <ErrorText>{failed ? t("common.genericError") : null}</ErrorText>
      <Button
        label={submitLabel}
        loading={busy}
        disabled={!name.trim()}
        onPress={() => void submit()}
      />
    </>
  );
}

/** Name and create a new category. */
export function NewCategoryForm({
  onCreated,
}: {
  onCreated: (categoryId: Id<"vault_categories">) => void;
}) {
  const { t } = useI18n();
  const create = useAuditedMutation(api.vault_categories.create);
  return (
    <CategoryNameForm
      submitLabel={t("categories.create")}
      onSubmit={async (encryptedName) =>
        onCreated(await create({ encryptedName }))
      }
    />
  );
}

/**
 * Category picker of capture, item details and the item actions: the
 * built-in categories the user kept, their own ones, and a row to add one.
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
  const builtIn = useBuiltInCategories();
  const current = useShownFiling()(value);
  const [naming, setNaming] = useState(false);

  function close() {
    setNaming(false);
    onDismiss();
  }

  function choose(choice: CategoryChoice) {
    onChange(choice);
    close();
  }

  return (
    <BottomSheet
      visible={visible}
      onDismiss={close}
      title={naming ? t("categories.new") : t("capture.categoryLabel")}
    >
      {naming ? (
        <NewCategoryForm
          onCreated={(categoryId) =>
            choose({ category: CUSTOM_FALLBACK, categoryId })
          }
        />
      ) : (
        <>
          {builtIn.map((category) => (
            <ListRow
              key={category}
              icon="document"
              title={t(`capture.category.${category}`)}
              selected={!current.categoryId && current.category === category}
              onPress={() => choose({ category })}
            />
          ))}
          {(categories ?? []).map((category) => (
            <ListRow
              key={category.id}
              icon="document"
              title={category.name ?? t("item.decrypting")}
              selected={current.categoryId === category.id}
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
