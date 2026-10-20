import { useState } from "react";
import { Pressable } from "react-native";
import { api } from "@keeplas/backend/_generated/api";

import { Button } from "@/components/button";
import { BottomSheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";

export function NamePrompt() {
  const { t } = useI18n();
  const updateProfile = useAuditedMutation(api.users.updateProfile);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save() {
    setBusy(true);
    setFailed(false);
    try {
      await updateProfile({ name: name.trim() });
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        hitSlop={8}
      >
        <Text variant="body-sm-strong" color="text.link">
          {t("home.addName")}
        </Text>
      </Pressable>
      <BottomSheet
        visible={open}
        onDismiss={() => setOpen(false)}
        title={t("home.addNameTitle")}
      >
        <TextField
          label={t("home.firstName")}
          value={name}
          onChangeText={setName}
          autoFocus
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="done"
          onSubmitEditing={() => name.trim() && void save()}
        />
        {failed ? (
          <Text variant="body-sm" color="status.revoked">
            {t("home.addNameFailed")}
          </Text>
        ) : null}
        <Button
          label={t("capture.save")}
          loading={busy}
          disabled={!name.trim()}
          onPress={() => void save()}
        />
      </BottomSheet>
    </>
  );
}
