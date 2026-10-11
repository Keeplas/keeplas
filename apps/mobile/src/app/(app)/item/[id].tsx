import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { NavBar } from "@/components/nav-bar";
import { DetailRows } from "@/components/rows";
import { Screen } from "@/components/screen";
import { Callout } from "@/components/surfaces";
import { Text } from "@/components/text";
import { decryptText } from "@/crypto/envelope";
import { parseItemMeta } from "@/crypto/item-meta";
import { useVaultData } from "@/features/vault/vault-data";
import { useI18n } from "@/providers/i18n-provider";

/** M07-5: decrypted item details; plaintext exists only in component memory. */
export default function ItemDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = id as Id<"vault_items">;
  const router = useRouter();
  const { t } = useI18n();
  const raw = useQuery(api.vault_items.getItem, { itemId });
  const files = useQuery(api.vault_items.getItemFiles, { itemId });
  const { itemKey } = useVaultData();
  const [opened, setOpened] = useState<{
    title: string;
    note: string;
    category: string;
  }>();

  useEffect(() => {
    if (!raw) return;
    let alive = true;
    void (async () => {
      const key = await itemKey(raw);
      const [title, note, meta] = await Promise.all([
        decryptText(raw.encryptedTitle ?? "", key),
        decryptText(raw.encryptedContent, key),
        decryptText(raw.encryptedMeta ?? "", key),
      ]);
      if (alive)
        setOpened({ title, note, category: parseItemMeta(meta).category });
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [raw, itemKey]);

  return (
    <Screen
      header={
        <NavBar title={opened?.title ?? t("item.title")} onBack={router.back} />
      }
    >
      <Text variant="h1">{opened?.title ?? t("item.decrypting")}</Text>
      {opened?.note ? <Text>{opened.note}</Text> : null}
      <DetailRows
        rows={[
          {
            icon: "folder",
            label: t("item.category"),
            value: opened?.category ?? "—",
          },
          {
            icon: "document",
            label: t("item.attachments"),
            value: String(files?.length ?? 0),
          },
        ]}
      />
      <Callout icon="lock" text={t("item.encrypted")} />
    </Screen>
  );
}
