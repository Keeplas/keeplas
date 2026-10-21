import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { useTheme } from "@/providers/theme-provider";
import { type, withAlpha } from "@/theme";
import { Text } from "./text";

export const OTP_LENGTH = 6;

/**
 * Six Figma `OTP Box`es (52×56, radius 12, 8 pt gap) over one hidden input,
 * so iOS / Android one-time-code autofill and paste work.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  invalid = false,
  label,
  secure = false,
  autoFocus = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  invalid?: boolean;
  label: string;
  secure?: boolean;
  autoFocus?: boolean;
}) {
  const { colors } = useTheme();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(autoFocus);
  const active = Math.min(value.length, OTP_LENGTH - 1);

  function handleChange(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, OTP_LENGTH);
    onChange(digits);
    if (digits.length === OTP_LENGTH) onComplete?.(digits);
  }

  return (
    <Pressable onPress={() => input.current?.focus()} style={styles.row}>
      {Array.from({ length: OTP_LENGTH }, (_, index) => {
        const isActive = focused && index === active;
        const borderColor = invalid
          ? colors["status.revoked"]
          : isActive
            ? colors["border.focus"]
            : colors["border.default"];
        return (
          <View
            key={index}
            style={[
              styles.ring,
              // Focus glow: border/focus at 25 % (Figma drop shadow, spread 3).
              {
                borderColor: isActive
                  ? withAlpha(colors["border.focus"], 0.25)
                  : "transparent",
              },
            ]}
          >
            <View
              style={[
                styles.box,
                {
                  backgroundColor: colors["bg.surface"],
                  borderColor,
                  borderWidth: isActive || invalid ? 2 : 1,
                },
              ]}
            >
              <Text style={type.digit}>
                {value[index] ? (secure ? "•" : value[index]) : ""}
              </Text>
            </View>
          </View>
        );
      })}
      <TextInput
        ref={input}
        accessibilityLabel={label}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType={secure ? "none" : "oneTimeCode"}
        autoComplete={secure ? "off" : "sms-otp"}
        secureTextEntry={secure}
        maxLength={OTP_LENGTH}
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 2, marginHorizontal: -3 },
  ring: { borderWidth: 3, borderRadius: 15 },
  box: {
    width: 52,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  hidden: { position: "absolute", width: 1, height: 1, opacity: 0 },
});
