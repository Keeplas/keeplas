import { useRef } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { useTheme } from "@/providers/theme-provider";
import { radius, singleLine, type } from "@/theme";
import { Text } from "./text";

/** Labelled input in the Phone Input frame (52 pt, radius 14, Body L). */
export function TextField({
  label,
  multiline,
  style,
  ...input
}: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  const ref = useRef<TextInput>(null);
  const frame = {
    backgroundColor: colors["bg.surface"],
    borderColor: colors["border.default"],
  };
  const field = (
    <TextInput
      ref={ref}
      accessibilityLabel={label}
      placeholderTextColor={colors["text.subtle"]}
      multiline={multiline}
      {...input}
      style={[
        multiline ? type["body-lg"] : singleLine(type["body-lg"]),
        multiline ? [styles.box, styles.multiline, frame] : null,
        { color: colors["text.primary"] },
        style,
      ]}
    />
  );
  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      {multiline ? (
        field
      ) : (
        <Pressable
          accessible={false}
          onPress={() => ref.current?.focus()}
          style={[styles.box, styles.frame, frame]}
        >
          {field}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  box: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14 },
  frame: { height: 52, justifyContent: "center" },
  multiline: { height: 140, paddingTop: 14, textAlignVertical: "top" },
});
