import { useRef, useState, type RefObject } from "react";
import {
  Clipboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { type, withAlpha } from "@/theme";
import { useRevealAboveKeyboard } from "./screen";
import { Text } from "./text";

export const OTP_LENGTH = 6;

/**
 * Six (or `length`) Figma `OTP Box`es (52×56, radius 12, 8 pt gap) drawn
 * over one transparent input, so iOS / Android one-time-code autofill works.
 * The input covers the whole row: screen readers find one labelled text
 * field there (the boxes are hidden from them), and the keyboard avoidance
 * lifts the whole row above the number pad. It takes no touches, so it has
 * no paste menu: a long press on the boxes pastes a code copied from
 * WhatsApp (one-time codes only, not a secure PIN). Boxes shrink to fit
 * narrow screens (iPhone SE: 335 pt of content for 352 pt of boxes).
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
  keepVisible,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  invalid?: boolean;
  label: string;
  secure?: boolean;
  autoFocus?: boolean;
  length?: number;
  /** Block to lift above the keyboard while typing, e.g. the boxes and the
   * action under them (Skip, Cancel). Defaults to the boxes alone. */
  keepVisible?: RefObject<View | null>;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const reveal = useRevealAboveKeyboard();
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
      accessible={false}
      onPress={() => input.current?.focus()}
      onLongPress={secure ? undefined : () => void paste()}
      style={styles.row}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.boxes}
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
      </View>
      <TextInput
        ref={input}
        accessibilityLabel={t("verify.field", { label, count: length })}
        value={value}
        onChangeText={handleChange}
        onFocus={() => {
          setFocused(true);
          if (keepVisible) reveal(keepVisible.current);
        }}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType={secure ? "none" : "oneTimeCode"}
        autoComplete={secure ? "off" : "sms-otp"}
        secureTextEntry={secure}
        maxLength={length}
        caretHidden
        style={styles.input}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignSelf: "stretch", marginHorizontal: -3 },
  boxes: { flexDirection: "row", justifyContent: "center", gap: 2 },
  ring: { flex: 1, maxWidth: 58, borderWidth: 3, borderRadius: 15 },
  box: {
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  // Over the whole row, so its frame (what screen readers outline and the
  // keyboard avoidance measures) is the row's. Drawn invisibly: transparent
  // text, and a near-zero opacity (TalkBack skips a view at 0, and Android
  // would tint an autofilled field). Taps go to the row (focus, paste).
  input: {
    ...StyleSheet.absoluteFill,
    color: "transparent",
    opacity: 0.02,
    pointerEvents: "none",
  },
});
