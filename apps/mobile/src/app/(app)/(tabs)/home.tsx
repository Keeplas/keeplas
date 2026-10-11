import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { Icon } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { Screen } from "@/components/screen";
import { IconTile, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import {
  greetingKey,
  groupCategoryCounts,
  VAULT_GROUPS,
} from "@/features/home/vault-groups";
import { readPreference } from "@/lib/preferences";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import { useTheme } from "@/providers/theme-provider";
import { colors as palette, radius, withAlpha } from "@/theme";

/**
 * M08-5 Home. Counts come from `hub.getHubData`; the item list (decrypted
 * titles) arrives with capture in the next part.
 */
export default function Home() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const viewer = useViewer();
  const hub = useQuery(api.hub.getHubData);
  const [kitExported, setKitExported] = useState(false);

  useEffect(() => {
    readPreference("kitExported").then((v) => setKitExported(v === "true"));
  }, []);

  const greeting = t(greetingKey(new Date().getHours()));
  const firstName = viewer.name?.trim().split(/\s+/)[0];
  const groups = groupCategoryCounts(hub?.categoryCounts ?? {});
  const contactsReady =
    hub?.priorityActions.find((a) => a.key === "contacts_ready")?.done ?? false;
  // Ways back in: this phone, 2 ready trust contacts, the recovery kit.
  const ready = 1 + (contactsReady ? 1 : 0) + (kitExported ? 1 : 0);
  const soon = () => Alert.alert(t("home.yourVault"), t("common.comingSoon"));
  const itemCount = (count: number) =>
    count === 1 ? t("home.item") : t("home.items", { count });

  return (
    <Screen
      header={
        <AppHeader
          right={
            <View style={styles.headerRight}>
              <Icon name="bell" size={22} />
              <LanguageDropdown />
            </View>
          }
        />
      }
      gap={12}
    >
      <Text variant="h1">
        {firstName
          ? t("home.greetingNamed", { greeting, name: firstName })
          : greeting}
      </Text>
      <Text variant="body-lg" color="text.muted">
        {t("home.subtitle")}
      </Text>
      <ListRow
        icon="shield-check"
        title={t("home.recoveryHealth")}
        description={t("home.healthReady", { n: ready })}
        onPress={soon}
      />
      <Text variant="label">{t("home.yourVault")}</Text>
      <View style={styles.tiles}>
        {VAULT_GROUPS.map((group) => (
          <Pressable
            key={group.key}
            onPress={soon}
            style={[
              styles.tile,
              {
                backgroundColor: colors["bg.surface"],
                borderColor: colors["border.default"],
              },
            ]}
          >
            <IconTile
              icon={group.icon}
              size={36}
              iconSize={18}
              background={withAlpha(palette.category[group.color], 0.12)}
              tint={palette.category[group.color]}
            />
            <View style={styles.tileText}>
              <Text variant="label">{t(`home.${group.key}`)}</Text>
              <Text variant="body-sm" color="text.muted">
                {itemCount(groups[group.key])}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
      <ListRow
        icon="mail"
        title={t("home.inbox")}
        description={t("home.inboxBody")}
        onPress={soon}
      />
      <View style={styles.sectionHeader}>
        <Text variant="label">{t("home.recent")}</Text>
        <Text variant="body-sm" color="text.link">
          {t("common.seeAll")}
        </Text>
      </View>
      <Text variant="body-sm" color="text.muted">
        {t("home.recentEmpty")}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "48.5%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  tileText: { flex: 1, gap: 2 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
