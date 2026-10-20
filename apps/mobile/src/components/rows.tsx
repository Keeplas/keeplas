import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "@/providers/theme-provider";
import { radius } from "@/theme";
import { Icon, type IconName } from "./icon";
import { Text } from "./text";

export interface DetailRow {
  icon: IconName;
  label: string;
  value: string;
  onPress?: () => void;
}

/**
 * Figma `App/Detail row` card (M07-5, M10-2, M10-4): 18 pt icon, muted
 * 14 pt label, 14 pt semibold value, 16 pt chevron; 1 pt separators.
 */
export function DetailRows({ rows }: { rows: DetailRow[] }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors["bg.surface"],
          borderColor: colors["border.default"],
        },
      ]}
    >
      {rows.map((row, index) => (
        <Pressable
          key={row.label}
          accessibilityRole={row.onPress ? "button" : undefined}
          onPress={row.onPress}
          disabled={!row.onPress}
          style={({ pressed }) => [
            styles.row,
            index > 0 && {
              borderTopWidth: 1,
              borderTopColor: colors["border.default"],
            },
            pressed && { backgroundColor: colors["bg.subtle"] },
          ]}
        >
          <Icon name={row.icon} size={18} color="text.muted" />
          <Text color="text.muted" style={[styles.rowText, styles.label]}>
            {row.label}
          </Text>
          <Text
            variant="label"
            align="right"
            style={[styles.rowText, styles.value]}
            numberOfLines={2}
          >
            {row.value}
          </Text>
          {row.onPress ? (
            <Icon name="chevron-right" size={16} color="text.muted" />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

/** Figma `Chip` (34 pt pill, 16 pt icon, Caption-strong label). */
export function Chip({
  icon,
  label,
  count,
  onPress,
  selected = false,
}: {
  icon?: IconName;
  label: string;
  count?: number;
  onPress: () => void;
  selected?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected
            ? colors["action.primary"]
            : pressed
              ? colors["bg.subtle"]
              : colors["bg.surface"],
          borderColor: selected
            ? colors["action.primary"]
            : colors["border.default"],
        },
      ]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={16}
          color={selected ? "text.inverse" : "text.primary"}
        />
      ) : null}
      <Text
        variant="body-sm-strong"
        color={selected ? "text.inverse" : "text.primary"}
      >
        {label}
      </Text>
      {count !== undefined ? (
        <View
          style={[
            styles.count,
            {
              backgroundColor: selected
                ? colors["bg.surface"]
                : colors["action.primary"],
            },
          ]}
        >
          <Text
            variant="caption"
            color={selected ? "text.primary" : "text.inverse"}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Section title row with an optional trailing link ("See all", "Add"). */
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.section}>
      <Text variant="label">{title}</Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          hitSlop={8}
        >
          <Text variant="body-sm" color="text.link">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  rowText: { fontSize: 14, lineHeight: 20 },
  label: { flex: 1 },
  value: { flexShrink: 1, maxWidth: "55%" },
  chip: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 18,
  },
  count: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
