import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Icon, type IconName } from "@/components/icon";
import { Text } from "@/components/text";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { withAlpha } from "@/theme";

/**
 * Vault list row: opens the item; its ⋯ button, a sibling of the row's
 * press so screen readers reach it, opens the item actions.
 */
export const VaultListRow = memo(function VaultListRow({
  id,
  title,
  subtitle,
  icon,
  color,
  access,
  accessLabel,
  onMore,
  first,
  last,
}: {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
  color: string;
  access: IconName;
  /** Who can see the item ("Only you"), read instead of the access icon. */
  accessLabel: string;
  onMore: (id: string) => void;
  first: boolean;
  last: boolean;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors["bg.surface"],
          borderColor: colors["border.default"],
          borderTopWidth: first ? 1 : 0,
          borderTopLeftRadius: first ? 20 : 0,
          borderTopRightRadius: first ? 20 : 0,
          borderBottomLeftRadius: last ? 20 : 0,
          borderBottomRightRadius: last ? 20 : 0,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${subtitle}, ${accessLabel}`}
        onPress={() => router.push({ pathname: "/item/[id]", params: { id } })}
        style={({ pressed }) => [
          styles.main,
          pressed && { backgroundColor: colors["bg.subtle"] },
        ]}
      >
        <View
          style={[styles.tile, { backgroundColor: withAlpha(color, 0.12) }]}
        >
          <Icon name={icon} size={20} tint={color} />
        </View>
        <View style={styles.text}>
          <Text variant="label" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="body-sm" color="text.muted" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Icon name={access} size={16} color="text.muted" />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("itemActions.more", { title })}
        onPress={() => onMore(id)}
        style={({ pressed }) => [
          styles.more,
          pressed && { backgroundColor: colors["bg.subtle"] },
        ]}
      >
        <Icon name="more" size={20} color="text.muted" />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    overflow: "hidden",
  },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 14,
    paddingVertical: 12,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
  // The row's 12 pt gap and right padding, as a full-height touch target.
  more: { justifyContent: "center", paddingHorizontal: 12 },
});
