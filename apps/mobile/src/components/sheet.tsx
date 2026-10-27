import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { colors as palette, radius, withAlpha } from "@/theme";
import { Icon } from "./icon";
import { Text } from "./text";

/**
 * Figma `Add menu / Sheet`: bottom sheet (radius 20 on top) over a
 * navy/950 35 % scrim, H3 title with a close button, 20 pt padding.
 * Rides above the keyboard so a focused field and its action stay visible.
 */
export function BottomSheet({
  visible,
  onDismiss,
  title,
  children,
  background = "bg.surface",
}: {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  children: ReactNode;
  background?: "bg.surface" | "bg.app";
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView behavior="padding" style={styles.scrim}>
        <Pressable style={styles.backdrop} onPress={onDismiss}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors[background],
                paddingTop: title ? 20 : 0,
                paddingBottom: Math.max(insets.bottom, 32),
              },
            ]}
          >
            {title ? (
              <View style={styles.header}>
                <Text variant="h3">{title}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("common.close")}
                  onPress={onDismiss}
                  hitSlop={12}
                >
                  <Icon name="close" size={22} color="text.muted" />
                </Pressable>
              </View>
            ) : null}
            {children}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    // Figma Scrim: navy/950 at 35 % (an overlay, same in both themes). Set
    // here, not on the backdrop, so the keyboard padding is dimmed too.
    backgroundColor: withAlpha(palette.navy["950"], 0.35),
  },
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 20,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
});
