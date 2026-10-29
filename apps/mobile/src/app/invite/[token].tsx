import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import Invitation from "../../../assets/illustrations/invitation.svg";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { setPendingInvite } from "@/features/people/pending-invite";
import { serverMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useSession } from "@/providers/session-provider";

/**
 * M06-5: resolves the deep-link token and binds acceptance to the signed-in
 * contact's verified channel and public key. Signed out, the invitation
 * waits through sign-in and reopens once the vault is unlocked.
 */
export default function Invite() {
  const { token = "" } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { viewer } = useSession();
  const invitation = useQuery(api.trusted_contacts.getInvitationByToken, {
    token,
  });
  const accept = useAuditedMutation(api.trusted_contacts.acceptInvitation);
  const decline = useAuditedMutation(api.trusted_contacts.declineInvitation);
  const [busy, setBusy] = useState(false);

  async function answer(choice: "accept" | "decline") {
    if (!viewer) {
      setPendingInvite(token);
      router.replace("/");
      return;
    }
    setBusy(true);
    try {
      if (choice === "accept")
        await accept({ token, contactPublicKey: viewer.publicKey });
      else await decline({ token });
      // Opened over the app: go back to it, not into a second copy of it.
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (error) {
      toast({
        variant: "error",
        title: t("common.genericError"),
        description: serverMessage(error),
      });
      setBusy(false);
    }
  }
  return (
    <Screen header={<AppHeader />} contentStyle={styles.content}>
      <View style={styles.art}>
        <Invitation width={240} height={180} />
      </View>
      <Text variant="h1" align="center">
        {t("invite.title")}
      </Text>
      <Text variant="body-lg" color="text.muted" align="center">
        {invitation
          ? t("invite.from", { name: invitation.inviterName })
          : t("invite.invalid")}
      </Text>
      <Button
        label={viewer ? t("invite.accept") : t("invite.signIn")}
        style={styles.full}
        loading={busy}
        disabled={!invitation || invitation.invitationStatus !== "pending"}
        onPress={() => void answer("accept")}
      />
      {viewer && invitation?.invitationStatus === "pending" ? (
        <Button
          label={t("invite.decline")}
          variant="text"
          onPress={() => void answer("decline")}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "center", paddingTop: 40 },
  art: { alignItems: "center" },
  full: { alignSelf: "stretch" },
});
