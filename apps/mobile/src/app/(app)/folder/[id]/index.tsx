import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { useVaultData } from "@/features/vault/vault-data";
import { useI18n } from "@/providers/i18n-provider";

export default function FolderDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { folders, items } = useVaultData();
  const folder = folders?.find((row) => row.id === id);
  const folderItems = items?.filter((item) => item.folderId === id) ?? [];
  return (
    <Screen
      header={
        <NavBar
          title={folder?.name ?? t("folders.title")}
          onBack={router.back}
        />
      }
    >
      <Text variant="h1">{folder?.name ?? t("folders.title")}</Text>
      <Text color="text.muted">
        {t("folders.items", { n: folderItems.length })}
      </Text>
      <Button
        label={t("folders.share")}
        onPress={() =>
          router.push({ pathname: "/folder/[id]/share", params: { id } })
        }
      />
      {folderItems.map((item) => (
        <ListRow
          key={item.id}
          icon="document"
          title={item.title ?? t("item.decrypting")}
          onPress={() =>
            router.push({ pathname: "/item/[id]", params: { id: item.id } })
          }
        />
      ))}
      {(folder?.grants ?? []).map((grant) => (
        <ListRow
          key={grant.grantId}
          icon="user-circle"
          title={grant.contactName}
          description={t(`folders.timing.${grant.timing}`)}
        />
      ))}
    </Screen>
  );
}
