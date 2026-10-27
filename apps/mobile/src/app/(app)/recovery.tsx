import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { Button } from "@/components/button";
import { ProgressBar } from "@/components/controls";
import { Icon } from "@/components/icon";
import { NavBar } from "@/components/nav-bar";
import { Screen } from "@/components/screen";
import {
  Callout,
  Card,
  InfoRow,
  ListRow,
  StatusChip,
} from "@/components/surfaces";
import { Text } from "@/components/text";
import { useRecoveryWays, WaysBackCard } from "@/features/recovery-ways";
import { useSealSocialRecovery } from "@/features/social-recovery";
import { serverMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { useI18n } from "@/providers/i18n-provider";

/** W04-5 mobile twin: configure social recovery and answer requests. */
export default function RecoveryCenter() {
  const router = useRouter();
  const { t } = useI18n();
  const health = useQuery(api.recovery.getHealth);
  const { targets, seal } = useSealSocialRecovery();
  const requests = useQuery(api.recovery.getRequestsForMe);
  const ways = useRecoveryWays();

  async function configure() {
    try {
      await seal();
    } catch (error) {
      toast({
        variant: "error",
        title: t("common.genericError"),
        description: serverMessage(error),
      });
    }
  }

  return (
    <Screen
      header={<NavBar title={t("recoveryCenter.title")} onBack={router.back} />}
    >
      <Text variant="h1">{t("recoveryCenter.title")}</Text>
      <Text color="text.muted">{t("recoveryCenter.body")}</Text>
      <StatusChip
        label={t(ways.covered ? "waysBack.covered" : "waysBack.notCovered")}
        tone={ways.covered ? "success" : "warning"}
      />
      <WaysBackCard ways={ways} />
      <Text variant="label">{t("recoveryCenter.trustContacts")}</Text>
      <Text variant="body-sm" color="text.muted">
        {t(
          health?.trustContacts.configured
            ? "recoveryCenter.ready"
            : "recoveryCenter.contactsBody",
        )}
      </Text>
      {targets && targets.contacts.length < 2 ? (
        <>
          <Card>
            <View style={styles.between}>
              <Text variant="label">{t("recoveryCenter.trustContacts")}</Text>
              <Text variant="label" color="status.pending">
                {t("recoveryCenter.ofTwo", { n: targets.contacts.length })}
              </Text>
            </View>
            <ProgressBar value={targets.contacts.length / 2} />
            {targets.contacts.map((contact) => (
              <InfoRow
                key={contact.contactId}
                leading={<Icon name="user-circle" size={22} />}
                title={contact.name}
                description={t("recoveryCenter.active")}
              />
            ))}
          </Card>
          <Callout
            tone="warning"
            icon="alert-triangle"
            text={t("recoveryCenter.needTwo", {
              n: targets.contacts.length,
            })}
          />
          <Button
            label={t("recoveryCenter.addContact")}
            onPress={() => router.push("/people/add")}
          />
        </>
      ) : (
        <Button
          label={
            health?.trustContacts.configured
              ? t("recoveryCenter.renew")
              : t("recoveryCenter.configure")
          }
          onPress={() => void configure()}
          disabled={!targets}
        />
      )}
      {requests?.length ? (
        <Text variant="label">{t("recoveryCenter.requests")}</Text>
      ) : null}
      {(requests ?? []).map((request) => (
        <ListRow
          key={request.requestId}
          icon="shield-check"
          title={request.ownerName || t("recoveryCenter.owner")}
          description={t("recoveryCenter.review")}
          onPress={() =>
            router.push({
              pathname: "/recovery-approval/[id]",
              params: { id: request.requestId },
            })
          }
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", justifyContent: "space-between" },
});
