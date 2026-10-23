import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { LANGUAGES, type Language } from "@/i18n/translate";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { useChangeLanguage } from "@/lib/use-change-language";
import { radius, welcomeSky } from "@/theme";
import { Radio } from "./controls";
import { Icon } from "./icon";
import { Text } from "./text";

/** Figma `Language Segment`: EN | FR pill (M01-1). */
export function LanguageSegment() {
  const { colors } = useTheme();
  const { language } = useI18n();
  const changeLanguage = useChangeLanguage();
  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.segment, { backgroundColor: colors["bg.info"] }]}
    >
      {LANGUAGES.map((code) => {
        const active = code === language;
        return (
          <Pressable
            key={code}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => changeLanguage(code)}
            hitSlop={{ top: 6, bottom: 6 }}
            style={[
              styles.segmentItem,
              active && { backgroundColor: colors["action.primary"] },
            ]}
          >
            <Text
              variant="label"
              color={active ? "text.inverse" : "text.muted"}
            >
              {code.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Figma `Language Dropdown`: "EN ⌄" pill opening a language picker. */
export function LanguageDropdown({ inverse = false }: { inverse?: boolean }) {
  const { colors } = useTheme();
  const { language, t } = useI18n();
  const changeLanguage = useChangeLanguage();
  const [open, setOpen] = useState(false);
  const fg = inverse ? welcomeSky.foreground : colors["text.primary"];

  function pick(code: Language) {
    setOpen(false);
    changeLanguage(code);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.language")}
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={[
          styles.dropdown,
          {
            borderColor: inverse
              ? welcomeSky.dropdownBorder
              : colors["border.default"],
            borderRadius: inverse ? 12 : radius.sm,
          },
        ]}
      >
        <Text variant="label" style={{ color: fg }}>
          {language.toUpperCase()}
        </Text>
        <Icon name="chevron-down" size={16} tint={fg} />
      </Pressable>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View
            style={[
              styles.menu,
              {
                backgroundColor: colors["bg.surface"],
                borderColor: colors["border.default"],
              },
            ]}
          >
            <Text variant="label">{t("common.language")}</Text>
            {LANGUAGES.map((code) => (
              <Radio
                key={code}
                selected={code === language}
                onPress={() => pick(code)}
                label={t(`languageNames.${code}`)}
              />
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: "row",
    padding: 3,
    borderRadius: radius.pill,
  },
  // Both pills are larger than in Figma so, with hitSlop, they clear the
  // 44 pt (iOS) / 48 dp (Android) minimum touch target.
  segmentItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 8,
    borderWidth: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    justifyContent: "center",
    padding: 40,
  },
  menu: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
});
