import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { Screen } from "@/components/screen";
import { StateMessage } from "@/components/state-message";
import { Callout, Card, IconTile } from "@/components/surfaces";
import { Text } from "@/components/text";
import { spacedCode } from "@/lib/format";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius } from "@/theme";
import type { PairingSession } from "./qr-flow";
import { usePairingLabels } from "./use-pairing-labels";

/**
 * M03-5 Log this browser in? Shown for every pairing QR, scanned or opened
 * as a link: nothing leaves the phone before Approve (then the biometric
 * prompt). The code must match the one next to the QR on the computer.
 */
export function PairingApproval({
  sessionId,
  session,
  code,
  busy,
  onApprove,
  onDecline,
  onClose,
}: {
  sessionId: string;
  session: PairingSession;
  code: string;
  busy: boolean;
  onApprove: () => void;
  onDecline: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const live = useQuery(api.pairing.get, {
    sessionId: sessionId as Id<"pairing_sessions">,
  });
  const [seenAt] = useState(Date.now);
  const labels = usePairingLabels(
    session.userAgent,
    session.approxLocation ?? "",
    seenAt,
  );
  const header = <AppHeader onBack={onClose} />;

  if (live === null && !busy) {
    return (
      <Screen header={header}>
        <StateMessage
          icon="clock"
          tone="warning"
          title={t("scan.expiredTitle")}
          body={t("scan.expiredBody")}
          primary={{ label: t("scan.scanAgain"), onPress: onClose }}
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={header}
      gap={14}
      footer={
        <View style={styles.footer}>
          <Button
            label={t("linkBrowser.approve")}
            loading={busy}
            onPress={onApprove}
          />
          <Button
            variant="secondary"
            label={t("linkBrowser.decline")}
            disabled={busy}
            onPress={onDecline}
          />
        </View>
      }
    >
      <Text variant="h1">{t("linkBrowser.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("linkBrowser.body")}
      </Text>
      <Card style={styles.device} gap={8}>
        <IconTile icon="globe" size={48} />
        <Text variant="h3" align="center">
          {labels.device}
        </Text>
        <View style={styles.inline}>
          <Icon name="map-pin" size={16} color="text.muted" />
          <Text variant="body-sm" color="text.muted">
            {labels.location}
          </Text>
        </View>
        <Text variant="body-sm" color="text.subtle">
          {labels.time}
        </Text>
      </Card>
      <View
        style={[
          styles.code,
          {
            backgroundColor: colors["bg.info"],
            borderColor: colors["border.strong"],
          },
        ]}
      >
        <Text variant="caption" color="text.muted">
          {t("linkBrowser.codeOnComputer")}
        </Text>
        <Text variant="code">{spacedCode(code)}</Text>
        <Text variant="body-sm" color="text.muted" align="center">
          {t("linkBrowser.codeBody")}
        </Text>
      </View>
      <Callout
        tone="warning"
        icon="alert-triangle"
        text={t("linkBrowser.warning")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 12 },
  device: { alignItems: "center", paddingVertical: 18 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  code: {
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: radius.md,
  },
});
