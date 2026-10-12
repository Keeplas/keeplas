import { StyleSheet, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { RequiredSteps } from "@/components/stepper";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { BiometricRing } from "@/features/biometric-ring";
import { PasskeyButton } from "@/features/passkey-step";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";

/** M01-3 Create your passkey. Skipped when the account already has one. */
export default function PasskeyScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const viewer = useViewer();
  const passkeys = useQuery(api.webauthn.listMyCredentials);

  if (passkeys && passkeys.length > 0) return <Redirect href="/vault" />;

  return (
    <Screen decor="branches" header={<AppHeader />}>
      <RequiredSteps completed={1} />
      <Text variant="h1">{t("passkey.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("passkey.body")}
      </Text>
      <View style={styles.art}>
        <BiometricRing kind="face" size={208} />
      </View>
      <PasskeyButton
        userId={viewer._id}
        label={t("passkey.cta")}
        onDone={() => router.replace("/vault")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: { flex: 1, justifyContent: "center", minHeight: 240 },
});
