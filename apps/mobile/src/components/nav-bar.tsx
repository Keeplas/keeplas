import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useI18n } from "@/providers/i18n-provider";
import { layout } from "@/theme";
import { Icon } from "./icon";
import { Text } from "./text";

/**
 * Figma task "Nav bar" (M07-3, M07-4, M07-7, M07-8, M02-2…): 52 pt, back
 * chevron, centred Label title, optional trailing action ("Save").
 */
export function NavBar({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            onPress={onBack}
            hitSlop={12}
          >
            <Icon name="chevron-left" />
          </Pressable>
        ) : null}
      </View>
      <Text
        variant="label"
        align="center"
        numberOfLines={1}
        style={styles.title}
      >
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

/** Text action for the NavBar's trailing slot ("Save", "Done"). */
export function NavAction({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      hitSlop={12}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Text variant="label" color="accent.text">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: layout.headerHeight,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  side: { width: 64, flexDirection: "row" },
  right: { justifyContent: "flex-end" },
  title: { flex: 1 },
});
