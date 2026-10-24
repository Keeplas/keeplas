import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { OtpInput, OTP_LENGTH } from "@/components/otp-input";
import { Screen } from "@/components/screen";
import { BottomSheet } from "@/components/sheet";
import { IconTile, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { DevicePinError, hasDevicePin } from "@/crypto/device-vault";
import { BiometricRing } from "@/features/biometric-ring";
import { useEnsureCloudBackup } from "@/features/cloud-backup";
import { pinErrorText } from "@/features/pin/use-pin-gate";
import { useI18n } from "@/providers/i18n-provider";
import { useSession, useViewer } from "@/providers/session-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius } from "@/theme";
import { useVault } from "@/providers/vault-provider";

/**
 * M08-6 Unlock my vault: Face ID / fingerprint releases the device key
 * that unwraps the MasterKey, plus the Keeplas code when this phone has one.
 */
export default function Unlock() {
  const router = useRouter();
  const { t } = useI18n();
  const viewer = useViewer();
  const { signOut, refreshDeviceVault } = useSession();
  const { unlock } = useVault();
  const ensureCloudBackup = useEnsureCloudBackup();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [needsPin, setNeedsPin] = useState(false);
  const [pin, setPin] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void hasDevicePin(viewer._id).then((has) => {
      if (alive) setNeedsPin(has);
    });
    return () => {
      alive = false;
    };
  }, [viewer._id]);

  const attempt = useCallback(async () => {
    setBusy(true);
    setFailed(null);
    try {
      const rootKey = await unlock(
        viewer._id,
        t("unlock.title"),
        needsPin ? pin : undefined,
      );
      if (rootKey) void ensureCloudBackup(rootKey);
    } catch (error) {
      setPin("");
      if (error instanceof DevicePinError && error.code === "wiped") {
        Alert.alert(t("pin.wipedTitle"), t("pin.wipedBody"));
        refreshDeviceVault();
      } else {
        setFailed(
          error instanceof DevicePinError
            ? pinErrorText(error, t)
            : t("unlock.failed"),
        );
      }
    } finally {
      setBusy(false);
    }
  }, [
    unlock,
    ensureCloudBackup,
    viewer._id,
    t,
    needsPin,
    pin,
    refreshDeviceVault,
  ]);

  const ready = !needsPin || pin.length === OTP_LENGTH;

  return (
    <Screen
      decor="lake"
      header={<AppHeader />}
      contentStyle={styles.aboveDecor}
    >
      <Text variant="h1" align="center">
        {t("unlock.title")}
      </Text>
      <Text variant="body-lg" color="text.muted" align="center">
        {t("unlock.body")}
      </Text>
      <View style={styles.art}>
        {/* Tapping the fingerprint does what the passkey button does. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("unlock.cta")}
          disabled={busy || !ready}
          onPress={attempt}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <BiometricRing kind="fingerprint" size={188} />
        </Pressable>
      </View>
      <Button
        label={t("unlock.cta")}
        chevron
        loading={busy}
        disabled={!ready}
        onPress={attempt}
      />
      {needsPin ? (
        <View
          style={[
            styles.code,
            {
              backgroundColor: colors["bg.warm"],
              borderColor: colors["border.default"],
            },
          ]}
        >
          <View style={styles.codeHeader}>
            <Icon name="shield-check" size={20} color="accent" />
            <View style={styles.flex}>
              <Text variant="label">{t("pin.unlockTitle")}</Text>
              <Text variant="body-sm" color="text.muted">
                {t("pin.unlockBody")}
              </Text>
            </View>
          </View>
          <OtpInput
            value={pin}
            onChange={setPin}
            invalid={failed !== null}
            label={t("pin.label")}
            secure
            autoFocus={false}
          />
        </View>
      ) : null}
      {failed ? (
        <Text variant="body-sm" color="status.revoked" align="center">
          {failed}
        </Text>
      ) : null}
      <Button
        variant="text"
        label={t("unlock.more")}
        onPress={() => setMoreOpen(true)}
      />
      <BottomSheet
        visible={moreOpen}
        onDismiss={() => setMoreOpen(false)}
        title={t("unlock.more")}
      >
        <ListRow
          icon="lifebuoy"
          title={t("unlock.lost")}
          description={t("unlock.lostBody")}
          onPress={() => {
            setMoreOpen(false);
            router.push("/lost-access");
          }}
        />
        <ListRow
          leading={
            <IconTile
              icon="revoke"
              color="status.revoked"
              background={colors["status.revoked.bg"]}
            />
          }
          title={t("settings.signOut")}
          description={t("unlock.signOutBody")}
          onPress={() => {
            setMoreOpen(false);
            void signOut();
          }}
        />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Keeps the actions clear of the landscape footer (246 pt, sky on top).
  aboveDecor: { paddingBottom: 190 },
  art: { flex: 1, justifyContent: "center", minHeight: 220 },
  pressed: { opacity: 0.7 },
  code: { gap: 12, padding: 14, borderWidth: 1, borderRadius: radius.md },
  codeHeader: { flexDirection: "row", gap: 10 },
  flex: { flex: 1, gap: 2 },
});
