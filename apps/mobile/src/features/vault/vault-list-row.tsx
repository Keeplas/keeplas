import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Icon, type IconName } from "@/components/icon";
import { Text } from "@/components/text";
import { useTheme } from "@/providers/theme-provider";
import { withAlpha } from "@/theme";

export const VaultListRow = memo(function VaultListRow({
  id,
  title,
  subtitle,
  icon,
  color,
  first,
  last,
}: {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
  color: string;
  first: boolean;
  last: boolean;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/item/[id]", params: { id } })}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors["bg.subtle"] : colors["bg.surface"],
          borderColor: colors["border.default"],
          borderTopWidth: first ? 1 : 0,
          borderTopLeftRadius: first ? 20 : 0,
          borderTopRightRadius: first ? 20 : 0,
          borderBottomLeftRadius: last ? 20 : 0,
          borderBottomRightRadius: last ? 20 : 0,
        },
      ]}
    >
      <View style={[styles.tile, { backgroundColor: withAlpha(color, 0.12) }]}>
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
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 12,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
});
