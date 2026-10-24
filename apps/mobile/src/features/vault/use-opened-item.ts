import { useCallback, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { unwrapOwnerDek } from "@/crypto/owner-keys";
import {
  openSealedItem,
  type OpenedItem,
  type SealedFile,
  type SealedItem,
} from "@/features/vault/open-sealed-item";
import { useVaultData } from "@/features/vault/vault-data";
import { errorReference } from "@/lib/file-errors";

/** Opens a sealed row once it, its files and its key are known. */
function useSealedItem<T extends SealedItem>(
  raw: T | null | undefined,
  files: readonly SealedFile[] | undefined,
  keyOf: (raw: T) => Promise<CryptoKey>,
) {
  const [opened, setOpened] = useState<OpenedItem>();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState<{
    attempt: number;
    reference: string;
  }>();

  useEffect(() => {
    if (!raw || !files) return;
    let alive = true;
    void (async () => {
      try {
        const item = await openSealedItem(raw, files, await keyOf(raw));
        if (alive) setOpened(item);
      } catch (error) {
        const reference = errorReference();
        if (__DEV__) console.warn(`[item ${reference}]`, error);
        if (alive) setFailed({ attempt, reference });
      }
    })();
    return () => {
      alive = false;
    };
  }, [raw, files, keyOf, attempt]);

  return {
    opened,
    failure: failed?.attempt === attempt ? failed.reference : undefined,
    retry: () => setAttempt((n) => n + 1),
  };
}

export function useOpenedItem(itemId: Id<"vault_items">) {
  const raw = useQuery(api.vault_items.getItem, { itemId });
  const files = useQuery(api.vault_items.getItemFiles, { itemId });
  const { itemKey } = useVaultData();
  return { raw, ...useSealedItem(raw, files, itemKey) };
}

/**
 * An item a trusted person released to me (Shared with me): its DEK is
 * wrapped to my own ML-KEM key. `shared` is null when it was not released
 * to me.
 */
export function useOpenedSharedItem(
  contactId: Id<"trusted_contacts">,
  itemId: Id<"vault_items">,
) {
  const shared = useQuery(api.memorial.getReleasedItemForMe, {
    contactId,
    itemId,
  });
  const files = useQuery(api.memorial.getMemorialItemFiles, {
    contactId,
    itemId,
  });
  const { ownerKeys } = useVaultData();
  const keyOf = useCallback(
    async ({ wrappedDek }: { wrappedDek: string | null }) => {
      if (!wrappedDek) throw new Error("Item is not wrapped to this account");
      return unwrapOwnerDek(wrappedDek, await ownerKeys());
    },
    [ownerKeys],
  );
  return { shared, ...useSealedItem(shared?.item, files, keyOf) };
}
