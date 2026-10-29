import { useCallback, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Icon, type IconName } from "@/components/icon";
import { Screen } from "@/components/screen";
import { ListRow, StatusChip } from "@/components/surfaces";
import { Text } from "@/components/text";
import { devicePinLength, PIN_LENGTH } from "@/crypto/device-vault";
import { cloudNames } from "@/features/cloud-backup";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";

/** M08-3 Privacy and security. */
export default function Privacy() {
  const router = useRouter();
  const { t } = useI18n();
  const viewer = useViewer();
  const passkeys = useQuery(api.webauthn.listMyCredentials);
  const [hasPin, setHasPin] = useState<boolean | null>(null);

  // Re-read when coming back from the PIN screen.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void devicePinLength(viewer._id).then((length) => {
        if (alive) setHasPin(length !== null);
      });
      return () => {
        alive = false;
      };
    }, [viewer._id]),
  );

  const rows: {
    key: string;
    icon: IconName;
    href: Href;
    trailing?: ReactNode;
  }[] = [
    {
      key: "passkey",
      icon: "fingerprint",
      href: "/passkeys",
      trailing: passkeys?.length ? (
        <StatusChip tone="success" label={t("oneWay.active")} />
      ) : undefined,
    },
    {
      key: "pin",
      icon: "pin",
      href: "/pin-code",
      trailing:
        hasPin === null ? undefined : (
          <View style={styles.trailing}>
            <StatusChip
              tone={hasPin ? "success" : "neutral"}
              label={t(hasPin ? "pin.on" : "pin.off")}
            />
            <Icon name="chevron-right" size={20} color="text.muted" />
          </View>
        ),
    },
    { key: "backup", icon: "cloud-upload", href: "/backup" },
    { key: "kit", icon: "lifebuoy", href: "/kit" },
    { key: "rotation", icon: "sync", href: "/rotate-keys" },
  ];

  return (
    <Screen header={<AppHeader onBack={router.back} />} gap={12}>
      <Text variant="h1">{t("privacy.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("privacy.subtitle")}
      </Text>
      {rows.map((row) => (
        <ListRow
          key={row.key}
          icon={row.icon}
          title={t(`privacy.${row.key}`)}
          description={t(`privacy.${row.key}Body`, {
            n: PIN_LENGTH,
            ...cloudNames,
          })}
          trailing={row.trailing}
          onPress={() => router.push(row.href)}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  trailing: { flexDirection: "row", alignItems: "center", gap: 6 },
});
