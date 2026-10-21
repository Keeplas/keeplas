import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Radio } from "@/components/controls";
import { Screen } from "@/components/screen";
import { Card, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { formatBytes } from "@/lib/format";
import { useChangeLanguage } from "@/lib/use-change-language";
import { useI18n } from "@/providers/i18n-provider";
import { useSession } from "@/providers/session-provider";
import { APPEARANCES, useTheme } from "@/providers/theme-provider";
import { colors as palette } from "@/theme";

const KINDS = [
  { kind: "document", color: palette.category.document },
  { kind: "image", color: palette.category.account },
  { kind: "audio", color: palette.category.instruction },
  { kind: "video", color: palette.category.note },
] as const;

/** M08-7 Settings: storage, account rows, language, appearance, sign out. */
export default function Settings() {
  const router = useRouter();
  const { t, language } = useI18n();
  const { appearance, setAppearance, colors } = useTheme();
  const { signOut } = useSession();
  const changeLanguage = useChangeLanguage();
  // getUsageStats re-reads every item and file server-side on each vault
  // change; only subscribe while this tab is actually visible.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const usage = useQuery(api.vaults.getUsageStats, focused ? {} : "skip");
  const lifeCheck = useQuery(api.life_check.getConfig, focused ? {} : "skip");

  const lifetime = usage?.plan === "lifetime";
  const appearanceLabel = {
    system: t("settings.appearanceSystem"),
    light: t("settings.appearanceLight"),
    dark: t("settings.appearanceDark"),
  };

  return (
    <Screen header={<AppHeader />} gap={12}>
      <Text variant="h1">{t("settings.title")}</Text>
      <Text variant="body-lg" color="text.muted">
        {t("settings.subtitle")}
      </Text>
      <Text variant="label">{t("settings.storage")}</Text>
      {usage ? (
        <Card>
          <View style={styles.between}>
            <Text variant="label">
              {t("settings.storageUsed", {
                used: formatBytes(usage.storageBytes),
                total: formatBytes(usage.quotaBytes),
              })}
            </Text>
            <Text variant="body" color="text.muted">
              {`${Math.round((usage.storageBytes / usage.quotaBytes) * 100)}%`}
            </Text>
          </View>
          <View
            style={[styles.bar, { backgroundColor: colors["progress.track"] }]}
          >
            {KINDS.map(({ kind, color }) =>
              usage.bytesByKind[kind] ? (
                <View
                  key={kind}
                  style={{
                    flex: usage.bytesByKind[kind] / usage.quotaBytes,
                    backgroundColor: color,
                  }}
                />
              ) : null,
            )}
            <View
              style={{
                flex: Math.max(0, 1 - usage.storageBytes / usage.quotaBytes),
              }}
            />
          </View>
          {KINDS.filter(({ kind }) => usage.bytesByKind[kind] > 0).map(
            ({ kind, color }) => (
              <View key={kind} style={styles.between}>
                <View style={styles.legend}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Text variant="body">{t(`settings.kind.${kind}`)}</Text>
                </View>
                <Text variant="body" color="text.muted">
                  {formatBytes(usage.bytesByKind[kind])}
                </Text>
              </View>
            ),
          )}
          <View
            style={[
              styles.divider,
              { backgroundColor: colors["border.default"] },
            ]}
          />
          <Text variant="body-sm" color="text.muted">
            {t("settings.storageLeft", {
              plan: t(lifetime ? "settings.planLifetime" : "settings.planFree"),
              left: formatBytes(
                Math.max(0, usage.quotaBytes - usage.storageBytes),
              ),
            })}
          </Text>
        </Card>
      ) : null}
      <Text variant="label">{t("settings.account")}</Text>
      <ListRow
        icon="laptop"
        title={t("privacy.devices")}
        description={t("privacy.devicesBody")}
        onPress={() => router.push("/devices")}
      />
      <ListRow
        icon="activity"
        title={t("privacy.activity")}
        description={t("privacy.activityBody")}
        onPress={() => router.push("/activity")}
      />
      <ListRow
        icon="shield-check"
        title={t("settings.plan")}
        description={t(
          lifetime ? "settings.planLifetime" : "settings.planFreeBody",
        )}
      />
      <ListRow
        icon="lock"
        title={t("settings.privacy")}
        description={t("settings.privacyBody")}
        onPress={() => router.push("/privacy")}
      />
      {lifeCheck ? (
        <ListRow
          icon="clock"
          title={t("settings.lifeCheck")}
          description={t(`frequency.${lifeCheck.frequency}`)}
          onPress={() => router.push("/life-check")}
        />
      ) : (
        <ListRow
          icon="clock"
          title={t("settings.lifeCheck")}
          description={t("lifeCheck.notConfigured")}
          onPress={() => router.push("/life-check")}
        />
      )}
      <ListRow
        icon="cloud-upload"
        title={t("backup.title")}
        description={t("backup.bodyShort")}
        onPress={() => router.push("/backup")}
      />
      <ListRow
        icon="globe"
        title={t("common.language")}
        description={t(`languageNames.${language}`)}
        onPress={() => changeLanguage(language === "en" ? "fr" : "en")}
      />
      <Text variant="label">{t("settings.appearance")}</Text>
      <Card>
        {APPEARANCES.map((mode) => (
          <Radio
            key={mode}
            selected={appearance === mode}
            onPress={() => setAppearance(mode)}
            label={appearanceLabel[mode]}
          />
        ))}
      </Card>
      {__DEV__ ? (
        <ListRow
          icon="activity"
          title={t("settings.selfTest")}
          onPress={() => router.push("/self-test")}
        />
      ) : null}
      <Button
        variant="secondary"
        label={t("settings.signOut")}
        onPress={signOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", justifyContent: "space-between" },
  bar: { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden" },
  legend: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  divider: { height: StyleSheet.hairlineWidth },
});
