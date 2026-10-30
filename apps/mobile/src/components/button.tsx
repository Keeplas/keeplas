import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@/providers/theme-provider";
import { radius, type, welcomeSky } from "@/theme";
import { Icon, type IconName } from "./icon";

/**
 * Figma `Button`: 52 pt high, radius 14, label Inter 600 16/20, optional
 * trailing chevron (20 pt). `text` is the 24 pt link-style variant (hitSlop
 * brings its touch target to 48 pt) and `glass` the outlined pill over the
 * M08-1 night landscape.
 */
export type ButtonVariant =
  "primary" | "secondary" | "danger" | "text" | "glass";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  chevron?: boolean;
  /** Leading 18 pt icon. */
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  chevron = false,
  icon,
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const { colors } = useTheme();

  const look: Record<ButtonVariant, { box: ViewStyle; text: string }> = {
    primary: {
      box: { backgroundColor: colors["action.primary"] },
      text: colors["text.inverse"],
    },
    secondary: {
      box: {
        backgroundColor: colors["bg.surface"],
        borderWidth: 1.5,
        borderColor: colors["action.primary"],
      },
      text: colors["action.primary"],
    },
    danger: {
      box: {
        backgroundColor: colors["bg.surface"],
        borderWidth: 1.5,
        borderColor: colors["action.danger"],
      },
      text: colors["action.danger"],
    },
    text: { box: styles.textBox, text: colors["text.link"] },
    glass: {
      box: {
        backgroundColor: welcomeSky.glass,
        borderWidth: 1.5,
        borderColor: welcomeSky.glassBorder,
        borderRadius: radius.xl,
      },
      text: welcomeSky.foreground,
    },
  };
  const { box, text } = look[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      // Kept while the label gives way to the spinner.
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      hitSlop={variant === "text" ? 12 : undefined}
      style={({ pressed }) => [
        styles.base,
        box,
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={text} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={18} tint={text} /> : null}
          <Text style={[type.button, styles.label, { color: text }]}>
            {label}
          </Text>
          {chevron && variant !== "glass" ? (
            <Icon name="chevron-right" size={20} tint={text} />
          ) : null}
        </View>
      )}
      {chevron && variant === "glass" ? (
        <View style={styles.glassChevron}>
          <Icon name="chevron-right" size={20} tint={text} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  textBox: { minHeight: 24, paddingHorizontal: 0, paddingVertical: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  label: { flexShrink: 1, textAlign: "center" },
  glassChevron: { position: "absolute", right: 24 },
});
