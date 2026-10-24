import { useState } from "react";
import { Alert } from "react-native";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { Button } from "@/components/button";
import { BottomSheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";

export interface CategoryToDelete {
  name: string;
  itemIds: Id<"vault_items">[];
  /** Deletes a user-made category, or hides a built-in one. */
  remove: () => Promise<unknown>;
  onDeleted?: () => void;
}

/**
 * Delete a category after a confirmation that says what happens to its
 * items. They are deleted too (archived, so restorable from Archives): when
 * there are any, the owner also types DELETE before anything happens.
 * Render `sheet` once in the screen.
 */
export function useDeleteCategory() {
  const { t } = useI18n();
  const archiveItems = useAuditedMutation(api.vault_items.archiveItems);
  const [target, setTarget] = useState<CategoryToDelete | null>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const word = t("deleteAccount.confirmWord");

  const itemsBody = (count: number) =>
    count === 1
      ? t("categories.deleteItemsOne")
      : t("categories.deleteItems", { n: count });

  async function run(category: CategoryToDelete) {
    if (category.itemIds.length) {
      await archiveItems({ itemIds: category.itemIds });
    }
    await category.remove();
    category.onDeleted?.();
  }

  const failed = () =>
    toast({ variant: "error", title: t("common.genericError") });

  function request(category: CategoryToDelete) {
    const count = category.itemIds.length;
    Alert.alert(
      t("categories.deleteTitle", { name: category.name }),
      count ? itemsBody(count) : t("categories.deleteEmptyBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("categories.delete"),
          style: "destructive",
          onPress: () => {
            if (!count) return void run(category).catch(failed);
            setTarget(category);
            setTyped("");
            setOpen(true);
          },
        },
      ],
    );
  }

  async function confirm() {
    if (!target) return;
    setBusy(true);
    try {
      await run(target);
      setOpen(false);
    } catch {
      failed();
    } finally {
      setBusy(false);
    }
  }

  const sheet = (
    <BottomSheet
      visible={open}
      onDismiss={() => setOpen(false)}
      title={target ? t("categories.deleteTitle", { name: target.name }) : ""}
    >
      <Text color="text.muted">
        {target ? itemsBody(target.itemIds.length) : ""}
      </Text>
      <TextField
        label={t("deleteAccount.typeLabel", { word })}
        value={typed}
        onChangeText={setTyped}
        placeholder={word}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
      />
      <Button
        variant="danger"
        label={t("categories.delete")}
        loading={busy}
        disabled={typed.trim().toUpperCase() !== word}
        onPress={() => void confirm()}
      />
    </BottomSheet>
  );

  return { request, sheet };
}
