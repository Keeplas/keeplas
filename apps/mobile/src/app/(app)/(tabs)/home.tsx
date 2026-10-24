import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import Branch from "../../../../assets/illustrations/branch.svg";
import { AppHeader } from "@/components/app-header";
import { Icon, type IconName } from "@/components/icon";
import { LanguageDropdown } from "@/components/language";
import { Screen } from "@/components/screen";
import { IconTile, ListRow } from "@/components/surfaces";
import { Text } from "@/components/text";
import { UpgradeCard } from "@/features/billing/upgrade-card";
import { NamePrompt } from "@/features/home/name-prompt";
import { useRecoveryWays } from "@/features/recovery-ways";
import { VaultItemRow } from "@/features/vault/item-row";
import { itemVisual } from "@/features/vault/item-visual";
import { useVaultData } from "@/features/vault/vault-data";
import { categoryCounts } from "@/features/vault/vault-filter";
import {
  greetingKey,
  listCounts,
  recentItems,
  VAULT_GROUPS,
} from "@/features/home/vault-groups";
import { formatDate, relativeDay } from "@/lib/format";
import { useI18n } from "@/providers/i18n-provider";
import { useViewer } from "@/providers/session-provider";
import { useTheme } from "@/providers/theme-provider";
import { colors as palette, radius, withAlpha } from "@/theme";
import { useDrafts } from "@/features/capture/draft-store";

/** M08-5 Home. Counts are computed on the device from the decrypted vault. */
export default function Home() {
  const { t, language } = useI18n();
  const router = useRouter();
  const viewer = useViewer();
  const deletion = useQuery(api.account_deletion.getStatus);
  const numberChange = useQuery(api.number_change.getMineOpen);
  const { items, pending, categories } = useVaultData();
  const hidden = viewer.hiddenCategoryGroups ?? [];
  const { covered } = useRecoveryWays();

  const greeting = t(greetingKey(new Date().getHours()));
  const firstName = viewer.name?.trim().split(/\s+/)[0];
  const drafts = useDrafts();
  const counts = useMemo(() => listCounts(items ?? []), [items]);
  const byCategory = useMemo(() => categoryCounts(items ?? []), [items]);
  const openCategory = (id: string) =>
    router.push({ pathname: "/category/[id]", params: { id } });
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
    <Screen
      header={
        <AppHeader
          right={
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("nav.search")}
                hitSlop={12}
                onPress={() => router.push("/search")}
              >
                <Icon name="search" size={22} />
              </Pressable>
              <LanguageDropdown />
            </View>
          }
        />
      }
      gap={12}
    >
      <View style={styles.hero}>
        {/* Light decor behind the greeting, bleeding into the right gutter. */}
        <View pointerEvents="none" style={styles.heroArt}>
          <Branch width={96} height={96} opacity={0.35} />
        </View>
        <Text variant="h1">
          {firstName
            ? t("home.greetingNamed", { greeting, name: firstName })
            : greeting}
        </Text>
        <Text variant="body-lg" color="text.muted">
          {t("home.subtitle")}
        </Text>
      </View>
      {firstName ? null : <NamePrompt />}
      {numberChange ? (
        <ListRow
          icon="shield-alert"
          title={t("numberChange.title")}
          description={t("numberChange.banner")}
          onPress={() => router.push("/number-change")}
        />
      ) : null}
      {deletion ? (
        <ListRow
          icon="alert-triangle"
          title={t("home.deletionTitle", {
            date: formatDate(deletion.scheduledAt, language),
          })}
          description={t("home.deletionBody")}
          onPress={() => router.push("/delete-account")}
        />
      ) : null}
      <ListRow
        icon="shield-check"
        title={t("home.recoveryHealth")}
        description={t(covered ? "waysBack.covered" : "waysBack.notCovered")}
        onPress={() => router.push("/recovery")}
      />
      {viewer.plan === "lifetime" ? null : <UpgradeCard />}
      <Text variant="label">{t("home.yourVault")}</Text>
      <View style={styles.tiles}>
        {VAULT_GROUPS.filter((group) => !hidden.includes(group.key)).map(
          (group) => (
            <VaultTile
              key={group.key}
              icon={group.icon}
              tint={palette.category[group.color]}
              label={t(`home.${group.key}`)}
              count={counts[group.key]}
              onPress={() => openCategory(group.key)}
            />
          ),
        )}
        {(categories ?? []).map((category) => (
          <VaultTile
            key={category.id}
            icon="document"
            tint={palette.category.other}
            label={category.name ?? t("item.decrypting")}
            count={byCategory.get(category.id) ?? 0}
            onPress={() => openCategory(category.id)}
          />
        ))}
      </View>
      {drafts.length ? (
        <ListRow
          icon="edit"
          title={t("drafts.title")}
          description={t("drafts.homeBody", { n: drafts.length })}
          onPress={() => router.push("/drafts")}
        />
      ) : null}
      {showRecent ? (
        <>
          <View style={styles.sectionHeader}>
            <Text variant="label">{t("home.recent")}</Text>
            <Pressable
              accessibilityRole="link"
              hitSlop={12}
              onPress={() =>
                router.push({
                  pathname: "/vault/[group]",
                  params: { group: "all" },
                })
              }
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

/** A "Your vault" tile: a category group or a folder, with its item count. */
function VaultTile({
  icon,
  tint,
  label,
  count,
  onPress,
}: {
  icon: IconName;
  tint: string;
  label: string;
  count: number;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const tone = withAlpha(tint, 0.12);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.tile,
        {
          backgroundColor: colors["bg.surface"],
          borderColor: colors["border.default"],
        },
      ]}
    >
      <IconTile
        icon={icon}
        size={36}
        iconSize={18}
        background={tone}
        tint={tint}
      />
      <View style={styles.tileText}>
        <Text variant="label" numberOfLines={1}>
          {label}
        </Text>
        <View
          style={styles.count}
          accessible
          accessibilityLabel={
            count === 1 ? t("home.item") : t("home.items", { count })
          }
        >
          <View style={[styles.badge, { backgroundColor: tone }]}>
            <Text variant="caption" style={{ color: tint }}>
              {count}
            </Text>
          </View>
          <Text variant="body-sm" color="text.muted">
            {count === 1 ? t("home.itemWord") : t("home.itemsWord")}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  hero: { gap: 12 },
  heroArt: {
    position: "absolute",
    top: -12,
    right: -16,
    transform: [{ scaleX: -1 }],
  },
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
