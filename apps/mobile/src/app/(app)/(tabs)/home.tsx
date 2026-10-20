import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { AppHeader } from "@/components/app-header";
import { LanguageDropdown } from "@/components/language";
import { Screen } from "@/components/screen";
import { IconTile, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { NamePrompt } from "@/features/home/name-prompt";
import { VaultItemRow } from "@/features/vault/item-row";
import { itemVisual } from "@/features/vault/item-visual";
import { useVaultData } from "@/features/vault/vault-data";
import {
  greetingKey,
  listCounts,
  recentItems,
  VAULT_GROUPS,
  type VaultListKey,
} from "@/features/home/vault-groups";
import { relativeDay } from "@/lib/format";
import { readPreference } from "@/lib/preferences";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import { useTheme } from "@/providers/theme-provider";
import { colors as palette, radius, withAlpha } from "@/theme";

/** M08-5 Home. Counts are computed on the device from the decrypted vault. */
export default function Home() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const router = useRouter();
  const viewer = useViewer();
  const contactsReady =
    useQuery(api.trusted_contacts.getContactsReady) ?? false;
  const shared = useQuery(api.folders.sharedWithMe);
  const { items, pending } = useVaultData();
  const [kitExported, setKitExported] = useState(false);

  useFocusEffect(
    useCallback(() => {
      readPreference("kitExported").then((v) => setKitExported(v === "true"));
    }, []),
  );

  const greeting = t(greetingKey(new Date().getHours()));
  const firstName = viewer.name?.trim().split(/\s+/)[0];
  const counts = useMemo(() => listCounts(items ?? []), [items]);
  const inboxCount = counts.inbox + pending.length;
  // Ways back in: this phone, 2 ready trust contacts, the recovery kit.
  const ready = 1 + (contactsReady ? 1 : 0) + (kitExported ? 1 : 0);
  const openList = (group: VaultListKey) =>
    router.push({ pathname: "/vault/[group]", params: { group } });
  const itemCount = (count: number) =>
    count === 1 ? t("home.item") : t("home.items", { count });
  const recent = useMemo(() => recentItems(items ?? []), [items]);
  const recentPending = pending.slice(0, 3);
  const showRecent = recent.length + recentPending.length > 0;
  const updated = (at: number) => {
    const when = relativeDay(at);
    return t("home.updated", {
      when: t(`vaultList.time.${when.key}`, { n: when.n }).toLocaleLowerCase(),
    });
  };

  return (
    <Screen header={<AppHeader right={<LanguageDropdown />} />} gap={12}>
      <Text variant="h1">
        {firstName
          ? t("home.greetingNamed", { greeting, name: firstName })
          : greeting}
      </Text>
      <Text variant="body-lg" color="text.muted">
        {t("home.subtitle")}
      </Text>
      {firstName ? null : <NamePrompt />}
      <ListRow
        icon="shield-check"
        title={t("home.recoveryHealth")}
        description={t("home.healthReady", { n: ready })}
        onPress={() => router.push("/recovery")}
      />
      <Text variant="label">{t("home.yourVault")}</Text>
      <View style={styles.tiles}>
        {VAULT_GROUPS.map((group) => (
          <Pressable
            key={group.key}
            accessibilityRole="button"
            onPress={() => openList(group.key)}
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
              <View
                style={styles.count}
                accessible
                accessibilityLabel={itemCount(counts[group.key])}
              >
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: withAlpha(
                        palette.category[group.color],
                        0.12,
                      ),
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    style={{ color: palette.category[group.color] }}
                  >
                    {counts[group.key]}
                  </Text>
                </View>
                <Text variant="body-sm" color="text.muted">
                  {counts[group.key] === 1
                    ? t("home.itemWord")
                    : t("home.itemsWord")}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
      <ListRow
        icon="mail"
        title={t("home.inbox")}
        description={
          inboxCount === 0
            ? t("home.inboxBody")
            : inboxCount === 1
              ? t("home.toOrganizeOne")
              : t("home.toOrganize", { count: inboxCount })
        }
        onPress={() => openList("inbox")}
      />
      {shared && shared.length > 0 ? (
        <ListRow
          icon="people"
          title={t("shared.title")}
          description={
            shared.length === 1
              ? t("shared.oneFolder")
              : t("shared.folders", { n: shared.length })
          }
          onPress={() => router.push("/shared")}
        />
      ) : null}
      {showRecent ? (
        <>
          <View style={styles.sectionHeader}>
            <Text variant="label">{t("home.recent")}</Text>
            <Pressable
              accessibilityRole="link"
              hitSlop={12}
              onPress={() => openList("all")}
            >
              <Text variant="body-sm" color="text.link">
                {t("common.seeAll")}
              </Text>
            </Pressable>
          </View>
          {recentPending.map(({ entry, title }) => (
            <ListRow
              key={entry.id}
              icon="cloud-upload"
              title={title ?? t("capture.untitled")}
              description={t(`home.outbox.${entry.status}`)}
            />
          ))}
          {recent.map((item) => (
            <VaultItemRow
              key={item.id}
              id={item.id}
              title={item.title ?? t("item.decrypting")}
              description={updated(item.updatedAt)}
              icon={itemVisual(item).icon}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  tileText: { flex: 1, gap: 4 },
  count: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
