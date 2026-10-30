import { useState, type ReactNode } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@keeplas/backend/_generated/api";

import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { Card, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { formatDate, formatTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useI18n } from "@/providers/i18n-provider";
import { colors as palette } from "@/theme";

type MyRequest = NonNullable<
  FunctionReturnType<typeof api.recovery.getMyRequest>
>;

/** The statuses `recovery.cancel` still stops. */
const CANCELLABLE: MyRequest["status"][] = [
  "pending",
  "approved_1",
  "approved_2",
  "released",
];

const AVATAR_COLORS = Object.values(palette.category);

/**
 * Each trusted contact asked about a recovery request, and their answer.
 * `pending` shows what to tell a contact who hasn't answered yet (the
 * recovering phone's verification code).
 */
export function RecoveryDecisions({
  contacts,
  pending,
}: {
  contacts: MyRequest["contacts"];
  pending?: (contact: MyRequest["contacts"][number]) => ReactNode;
}) {
  const { t, language } = useI18n();
  return contacts.map((contact, index) => (
    <View key={contact.contactId} style={styles.row}>
      <View
        style={[
          styles.avatar,
          { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] },
        ]}
      >
        <Text variant="label" color="text.inverse">
          {(contact.name || "?").trim().charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text variant="label">{contact.name}</Text>
        {contact.decidedAt ? (
          <Text variant="body-sm" color="text.muted">
            {`${formatDate(contact.decidedAt, language)} · ${formatTime(contact.decidedAt, language)}`}
          </Text>
        ) : (
          (pending?.(contact) ?? null)
        )}
      </View>
      <StatusChip
        label={
          contact.decision === "approve"
            ? t("socialRecovery.approved")
            : contact.decision === "reject"
              ? t("socialRecovery.declined")
              : t("socialRecovery.waiting")
        }
        tone={
          contact.decision === "approve"
            ? "success"
            : contact.decision === "reject"
              ? "danger"
              : "warning"
        }
      />
    </View>
  ));
}

/**
 * Owner side, on any unlocked phone: a recovery asked for this account
 * (the "someone asked to recover your account" alert opens here), with
 * "It wasn't me" to stop it.
 */
export function RecoveryRequestCard() {
  const { t, language } = useI18n();
  const request = useQuery(api.recovery.getMyRequest);
  const cancel = useAuditedMutation(api.recovery.cancel);
  const [busy, setBusy] = useState(false);

  if (!request || !CANCELLABLE.includes(request.status)) return null;

  const at = (time: number) =>
    `${formatDate(time, language)} · ${formatTime(time, language)}`;

  async function notMe() {
    setBusy(true);
    try {
      await cancel({});
      toast({
        variant: "success",
        title: t("recoveryCenter.request.cancelled"),
      });
    } catch {
      toast({ variant: "error", title: t("common.genericError") });
    } finally {
      setBusy(false);
    }
  }

  function confirmNotMe() {
    Alert.alert(
      t("recoveryCenter.request.cancelTitle"),
      t("recoveryCenter.request.cancelBody"),
      [
        { text: t("socialRecovery.keep"), style: "cancel" },
        {
          text: t("socialRecovery.cancel"),
          style: "destructive",
          onPress: () => void notMe(),
        },
      ],
    );
  }

  return (
    <Card>
      <View style={styles.row}>
        <Icon name="shield-alert" size={22} color="status.revoked" />
        <Text variant="label" style={styles.flex}>
          {t("recoveryCenter.request.title")}
        </Text>
      </View>
      <Text variant="body-sm" color="text.muted">
        {t(
          request.status === "released"
            ? "recoveryCenter.request.released"
            : "recoveryCenter.request.waiting",
          { asked: at(request.createdAt), deadline: at(request.windowEndsAt) },
        )}
      </Text>
      <RecoveryDecisions contacts={request.contacts} />
      <Button
        variant="danger"
        label={t("recoveryCenter.request.notMe")}
        loading={busy}
        onPress={confirmNotMe}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
