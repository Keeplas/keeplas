import { useState } from "react";
import { useRouter } from "expo-router";
import { api } from "@keeplas/backend/_generated/api";

import { Button } from "@/components/button";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import { TextField } from "@/components/text-field";
import { Text } from "@/components/text";
import { encryptText } from "@/crypto/envelope";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useVault } from "@/providers/vault-provider";

export default function NewFolder() {
  const router = useRouter();
  const { t } = useI18n();
  const { masterKey } = useVault();
  const create = useAuditedMutation(api.folders.create);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!masterKey) return;
    setBusy(true);
    try {
      await create({
        encryptedName: await encryptText(name.trim(), masterKey),
      });
      router.back();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      header={<NavBar title={t("folders.new")} onBack={router.back} />}
      footer={
        <Button
          label={t("folders.create")}
          onPress={() => void submit()}
          loading={busy}
          disabled={!name.trim()}
        />
      }
    >
      <Text variant="h1">{t("folders.new")}</Text>
      <Text color="text.muted">{t("folders.newBody")}</Text>
      <TextField
        label={t("folders.name")}
        value={name}
        onChangeText={setName}
        autoFocus
      />
    </Screen>
  );
}
