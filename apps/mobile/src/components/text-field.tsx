import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { useTheme } from "@/providers/theme-provider";
import { radius, type } from "@/theme";
import { Text } from "./text";

/** Labelled input in the Phone Input frame (52 pt, radius 14, Body L). */
export function TextField({
  label,
  multiline,
  style,
  ...input
}: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors["text.subtle"]}
        multiline={multiline}
        {...input}
        style={[
          type["body-lg"],
          styles.input,
          multiline && styles.multiline,
          {
            color: colors["text.primary"],
            backgroundColor: colors["bg.surface"],
            borderColor: colors["border.default"],
          },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  multiline: { height: 140, paddingTop: 14, textAlignVertical: "top" },
});
