import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dismissToast, useToast, type ToastVariant } from "@/lib/toast";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { layout, radius, type SemanticToken } from "@/theme";
import { Icon, type IconName } from "./icon";
import { Text } from "./text";

// Same look as the web toast (@keeplas/ui): one surface for every variant,
// the variant only picks the icon. `default` is a plain message.
const VARIANT_ICONS: Partial<
  Record<ToastVariant, { name: IconName; color: SemanticToken }>
> = {
  success: { name: "check-circle", color: "status.active" },
  error: { name: "alert-circle", color: "action.danger" },
  info: { name: "info", color: "accent" },
};

/** Renders the current `toast()` message under the status bar. */
export function Toaster() {
  const message = useToast();
  const { colors, scheme } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [shown] = useState(() => new Animated.Value(0));

  // Slide in only when a toast appears: a replacement (e.g. a progress
  // update) swaps its text in place instead of blinking.
  const visible = message !== null;
  useEffect(() => {
    if (!visible) return;
    shown.setValue(0);
    Animated.timing(shown, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, shown]);

  useEffect(() => {
    if (!message) return;
    AccessibilityInfo.announceForAccessibility(
      [message.title, message.description].filter(Boolean).join(". "),
    );
  }, [message]);

  if (!message) return null;
  const icon = VARIANT_ICONS[message.variant];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.viewport,
        {
          top: insets.top + 8,
          opacity: shown,
          transform: [
            {
              translateY: shown.interpolate({
                inputRange: [0, 1],
                outputRange: [-12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        onPress={() => dismissToast(message.id)}
        style={[
          styles.toast,
          {
            backgroundColor: colors["bg.surface"],
            borderColor: colors["border.default"],
          },
          scheme === "light" && {
            shadowColor: colors["text.primary"],
            shadowOpacity: 0.1,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 6,
          },
        ]}
      >
        {icon ? <Icon name={icon.name} size={22} color={icon.color} /> : null}
        <View style={styles.text}>
          <Text variant="label">{message.title}</Text>
          {message.description ? (
            <Text variant="body-sm" color="text.body">
              {message.description}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          hitSlop={12}
          onPress={() => dismissToast(message.id)}
        >
          <Icon name="close" size={18} color="text.muted" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: "absolute",
    left: layout.gutter,
    right: layout.gutter,
  },
  toast: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  text: { flex: 1, gap: 2 },
});
