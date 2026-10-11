import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/providers/theme-provider";
import { radius } from "@/theme";
import { Button } from "./button";
import type { IconName } from "./icon";
import { IconBadge, type Tone } from "./surfaces";
import { Text } from "./text";

export interface StateAction {
  label: string;
  onPress: () => void;
}

export interface StateMessageProps {
  icon: IconName;
  tone: Tone;
  title: string;
  body?: string;
  primary?: StateAction;
  secondary?: StateAction;
}

/**
 * Figma `State Message` (section 10 template): 80 pt tinted badge, H2 title,
 * Body text, primary button and a text-style secondary action.
 */
export function StateMessage({
  icon,
  tone,
  title,
  body,
  primary,
  secondary,
}: StateMessageProps) {
  return (
    <View style={styles.message}>
      <IconBadge icon={icon} tone={tone} size={80} />
      <View style={styles.spacer4} />
      <Text variant="h2" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="body" color="text.muted" align="center">
          {body}
        </Text>
      ) : null}
      <View style={styles.spacer8} />
      {primary ? (
        <Button
          label={primary.label}
          onPress={primary.onPress}
          style={styles.full}
        />
      ) : null}
      {secondary ? (
        <Button
          variant="text"
          label={secondary.label}
          onPress={secondary.onPress}
          style={styles.full}
        />
      ) : null}
    </View>
  );
}

/** A State Message presented as a bottom sheet (radius 20) over a screen. */
export function StateSheet({
  visible,
  onDismiss,
  ...message
}: StateMessageProps & { visible: boolean; onDismiss: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors["bg.app"],
              paddingBottom: Math.max(insets.bottom, 32),
            },
          ]}
        >
          <StateMessage {...message} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  message: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  spacer4: { height: 4 },
  spacer8: { height: 8 },
  full: { alignSelf: "stretch" },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
});
