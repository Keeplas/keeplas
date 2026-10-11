import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import Invitation from "../../../assets/illustrations/invitation.svg";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useI18n } from "@/providers/i18n-provider";

/**
 * `keeplas://invite/<token>`: placeholder until invitation acceptance
 * (M06-5) lands in part 2. The token stays in the route for that screen.
 */
export default function Invite() {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <Screen header={<AppHeader />} contentStyle={styles.content}>
      <View style={styles.art}>
        <Invitation width={240} height={180} />
      </View>
      <Text variant="h1" align="center">
        {t("invite.title")}
      </Text>
      <Text variant="body-lg" color="text.muted" align="center">
        {t("invite.body")}
      </Text>
      <Button
        label={t("invite.cta")}
        style={styles.full}
        onPress={() => router.replace("/")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "center", paddingTop: 40 },
  art: { alignItems: "center" },
  full: { alignSelf: "stretch" },
});
