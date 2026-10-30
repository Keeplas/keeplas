import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { colors as palette, radius, withAlpha } from "@/theme";
import { Icon } from "./icon";
import { Text } from "./text";
import { Toaster } from "./toaster";

/** Scrim left above the tallest sheet, below the status bar. */
const TOP_GAP = 24;

/**
 * Figma `Add menu / Sheet`: bottom sheet (radius 20 on top) over a
 * navy/950 35 % scrim, H3 title with a close button, 20 pt padding.
 * Rides above the keyboard so a focused field and its action stay visible.
 * Never taller than the screen: the title stays put and the content
 * scrolls. Its own Toaster shows toasts raised while it is open, which
 * the Modal would otherwise hide.
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
        <Backdrop
          onDismiss={onDismiss}
          style={[styles.backdrop, { paddingTop: insets.top + TOP_GAP }]}
        >
          {/* Catches taps so they don't reach the backdrop. */}
          <Pressable
            accessible={false}
            style={[
              styles.sheet,
              {
                backgroundColor: colors[background],
                paddingTop: title ? 20 : 0,
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
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.content,
                { paddingBottom: insets.bottom + 20 },
              ]}
              keyboardShouldPersistTaps="handled"
              alwaysBounceVertical={false}
            >
              {children}
            </ScrollView>
          </Pressable>
        </Backdrop>
      </KeyboardAvoidingView>
      <Toaster />
    </Modal>
  );
}

/**
 * Tap-outside-to-close layer of a transparent Modal (sheets, menus). Not an
 * accessibility element itself, so screen readers reach each control inside
 * it one by one. Modal for VoiceOver (the screen behind is not read) and
 * closed by its escape gesture (two-finger scrub); Android's back button
 * goes through the Modal's `onRequestClose`.
 */
export function Backdrop({
  onDismiss,
  style,
  children,
}: {
  onDismiss: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessible={false}
      accessibilityViewIsModal
      onAccessibilityEscape={onDismiss}
      onPress={onDismiss}
      style={style}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    // Figma Scrim: navy/950 at 35 % (an overlay, same in both themes). Set
    // here, not on the backdrop, so the keyboard padding is dimmed too.
    backgroundColor: withAlpha(palette.navy["950"], 0.35),
  },
  // Its top padding caps the sheet's height; the keyboard padding above
  // takes more room away while a field is focused.
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    flexShrink: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  // As tall as its content until the sheet runs out of room, then scrolls.
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: 20, gap: 10 },
});
