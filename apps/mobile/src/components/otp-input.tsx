import { useRef, useState } from "react";
import {
  Clipboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { useTheme } from "@/providers/theme-provider";
import { type, withAlpha } from "@/theme";
import { Text } from "./text";

export const OTP_LENGTH = 6;

/**
 * Six (or `length`) Figma `OTP Box`es (52×56, radius 12, 8 pt gap) over one hidden input,
 * so iOS / Android one-time-code autofill works. The hidden input has no
 * paste menu, so a long press on the boxes pastes a code copied from
 * WhatsApp (one-time codes only, not a secure PIN). Boxes shrink to
 * fit narrow screens (iPhone SE: 335 pt of content for 352 pt of boxes).
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  invalid = false,
  label,
  secure = false,
  autoFocus = true,
  length = OTP_LENGTH,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  invalid?: boolean;
  label: string;
  secure?: boolean;
  autoFocus?: boolean;
  length?: number;
}) {
  const { colors } = useTheme();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(autoFocus);
  const active = Math.min(value.length, length - 1);

  function handleChange(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  }

  // Only a whole code: a copied phone number must not be cut into one.
  // React Native's own Clipboard (deprecated, still shipped in 0.86) avoids
  // a new native dependency; move to expo-clipboard once React Native drops it.
  async function paste() {
    const digits = (await Clipboard.getString()).replace(/\D/g, "");
    if (digits.length === length) handleChange(digits);
  }

  return (
    <Pressable
      onPress={() => input.current?.focus()}
      onLongPress={secure ? undefined : () => void paste()}
      style={styles.row}
    >
      {Array.from({ length }, (_, index) => {
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
        maxLength={length}
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignSelf: "stretch",
    justifyContent: "center",
    gap: 2,
    marginHorizontal: -3,
  },
  ring: { flex: 1, maxWidth: 58, borderWidth: 3, borderRadius: 15 },
  box: {
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  hidden: { position: "absolute", width: 1, height: 1, opacity: 0 },
});
