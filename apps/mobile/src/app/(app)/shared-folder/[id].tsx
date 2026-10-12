import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { unwrapBytes, unwrapDek } from "@keeplas/crypto/kem";

import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { decryptText } from "@/crypto/envelope";
import { useVaultData } from "@/features/vault/vault-data";
import { useI18n } from "@/providers/i18n-provider";

export default function SharedFolder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const grantId = id as Id<"folder_grants">;
  const router = useRouter();
  const { t } = useI18n();
  const folder = useQuery(api.folders.getSharedFolder, { grantId });
  const grants = useQuery(api.folders.sharedWithMe);
  const grant = grants?.find((row) => row.grantId === id);
  const { ownerKeys } = useVaultData();
  const [name, setName] = useState("");
  const [items, setItems] = useState<
    { id: Id<"vault_items">; title: string }[]
  >([]);

  useEffect(() => {
    if (!folder || !grant) return;
    let alive = true;
    void (async () => {
      const keys = await ownerKeys();
      const openedName = new TextDecoder().decode(
        await unwrapBytes(grant.sealedName, keys.secretKey),
      );
      const opened = await Promise.all(
        folder.items
          .filter((item) => item.wrappedDek)
          .map(async (item) => ({
            id: item._id,
            title: await decryptText(
              item.encryptedTitle ?? "",
              await unwrapDek(item.wrappedDek!, keys.secretKey),
            ),
          })),
      );
      if (alive) {
        setName(openedName);
        setItems(opened);
      }
    })();
    return () => {
      alive = false;
    };
  }, [folder, grant, ownerKeys]);

  return (
    <Screen
      header={
        <NavBar title={name || t("folders.title")} onBack={router.back} />
      }
    >
      <Text variant="h1">{name || t("folders.title")}</Text>
      <Text color="text.muted">
        {t("folders.from", { name: folder?.ownerName ?? "" })}
      </Text>
      {items.map((item) => (
        <ListRow key={item.id} icon="document" title={item.title} />
      ))}
    </Screen>
  );
}
