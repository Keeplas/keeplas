import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { createSocialRecovery } from "@keeplas/crypto/social";

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
import { contactKeyMaterial, requireVerifiedKey } from "@/crypto/contact-keys";
import { useRecoveryWays, WaysBackCard } from "@/features/recovery-ways";
import { serverMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { useAuditedAction } from "@/lib/use-audited-action";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";

/** W04-5 mobile twin: configure social recovery and answer requests. */
export default function RecoveryCenter() {
  const router = useRouter();
  const { t } = useI18n();
  const viewer = useViewer();
  const { exportRawMasterKey } = useVault();
  const health = useQuery(api.recovery.getHealth);
  const targets = useQuery(api.recovery.getSetupTargets);
  const requests = useQuery(api.recovery.getRequestsForMe);
  const myRequest = useQuery(api.recovery.getMyRequest);
  const ways = useRecoveryWays();
  const pin = useAuditedMutation(api.trusted_contacts.pinContactIdentity);
  const setup = useAuditedAction(api.recovery_node.setup);

  async function configure() {
    if (!targets) return;
    const masterKey = await exportRawMasterKey();
    try {
      const contacts = await Promise.all(
        targets.contacts.map(async (contact) => ({
          contactId: contact.contactId,
          publicKey: await requireVerifiedKey(
            contactKeyMaterial({ _id: contact.contactId, ...contact }),
            (contactId, fingerprint) =>
              pin({
                contactId: contactId as typeof contact.contactId,
                fingerprint,
              }),
          ),
        })),
      );
      const material = await createSocialRecovery({
        masterKey,
        userId: viewer._id,
        generation: targets.nextGeneration,
        contacts,
      });
      await setup({
        ...material,
        shares: material.shares.map((share) => ({
          ...share,
          contactId:
            share.contactId as (typeof targets.contacts)[number]["contactId"],
        })),
        completesRequestId:
          myRequest?.status === "released" ? myRequest.requestId : undefined,
      });
    } catch (error) {
      toast({
        variant: "error",
        title: t("common.genericError"),
        description: serverMessage(error),
      });
    } finally {
      masterKey.fill(0);
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
