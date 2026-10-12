import { StyleSheet, View } from "react-native";

import { Button } from "./button";
import { BottomSheet } from "./sheet";
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
  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} background="bg.app">
      <StateMessage {...message} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  message: {
    alignItems: "center",
    gap: 12,
    paddingTop: 40,
  },
  spacer4: { height: 4 },
  spacer8: { height: 8 },
  full: { alignSelf: "stretch" },
});
