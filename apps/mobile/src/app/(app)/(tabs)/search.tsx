import { useState } from "react";
import { useRouter } from "expo-router";
import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { ListRow } from "@/components/surfaces";
import { TextField } from "@/components/text-field";
import { Text } from "@/components/text";
import { useVaultData } from "@/features/vault/vault-data";
import { useI18n } from "@/providers/i18n-provider";

/** Local-only search over decrypted in-memory titles. */
export default function Search() {
  const router = useRouter();
  const { t } = useI18n();
  const { items } = useVaultData();
  const [term, setTerm] = useState("");
  const needle = term.trim().toLocaleLowerCase();
  const results = (items ?? []).filter(
    (item) => !needle || item.title?.toLocaleLowerCase().includes(needle),
  );
  return (
    <Screen header={<AppHeader />}>
      <Text variant="h1">{t("nav.search")}</Text>
      <TextField
        label={t("search.label")}
        placeholder={t("search.placeholder")}
        value={term}
        onChangeText={setTerm}
        autoFocus
      />
      {results.map((item) => (
        <ListRow
          key={item.id}
          icon="document"
          title={item.title ?? t("item.decrypting")}
          description={t(`capture.category.${item.category}`)}
          onPress={() =>
            router.push({ pathname: "/item/[id]", params: { id: item.id } })
          }
        />
      ))}
      {needle && results.length === 0 ? (
        <Text color="text.muted">{t("search.empty")}</Text>
      ) : null}
    </Screen>
  );
}
