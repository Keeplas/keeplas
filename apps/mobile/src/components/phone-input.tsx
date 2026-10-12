import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import {
  examplePlaceholder,
  flagEmoji,
  isTooLong,
  listCountries,
  type CountryCode,
} from "@/lib/phone";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius, type } from "@/theme";
import { Icon } from "./icon";
import { Text } from "./text";

/**
 * Figma `Phone Input` (52 pt, radius 14): country flag + dial code + chevron,
 * 1 pt divider, national number in Body L. Tapping the country opens a
 * searchable country list.
 */
export function PhoneInput({
  country,
  onCountryChange,
  value,
  onChangeText,
  onSubmit,
  invalid = false,
}: {
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  value: string;
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
  invalid?: boolean;
}) {
  const { colors } = useTheme();
  const { t, language } = useI18n();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const countries = useMemo(() => listCountries(language), [language]);
  const selected = countries.find((c) => c.code === country);
  const filtered = query
    ? countries.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.dialCode.includes(query),
      )
    : countries;

  return (
    <View
      style={[
        styles.field,
        {
          backgroundColor: colors["bg.surface"],
          borderColor: invalid
            ? colors["status.revoked"]
            : colors["border.default"],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("phone.chooseCountry")}
        onPress={() => setPicking(true)}
        style={styles.country}
      >
        <View style={styles.flag}>
          <Text style={styles.flagEmoji}>{flagEmoji(country)}</Text>
        </View>
        <Text variant="label">{selected?.dialCode}</Text>
        <Icon name="chevron-down" size={16} />
      </Pressable>
      <View
        style={[styles.divider, { backgroundColor: colors["border.default"] }]}
      />
      <TextInput
        accessibilityLabel={t("phone.label")}
        value={value}
        onChangeText={(next) => {
          // Shorter is always allowed, so a value left too long by a country
          // switch stays editable.
          if (next.length < value.length || !isTooLong(country, next))
            onChangeText(next);
        }}
        onSubmitEditing={onSubmit}
        placeholder={examplePlaceholder(country)}
        placeholderTextColor={colors["text.subtle"]}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        returnKeyType="done"
        style={[
          type["body-lg"],
          styles.input,
          { color: colors["text.primary"] },
        ]}
      />
      <Modal
        visible={picking}
        animationType="slide"
        // iOS page sheet: sits below the status bar and closes on swipe down.
        presentationStyle="pageSheet"
        onRequestClose={() => setPicking(false)}
      >
        {/* A modal is its own native root, so insets are measured here. */}
        <SafeAreaProvider>
          <SafeAreaView
            style={[styles.sheet, { backgroundColor: colors["bg.app"] }]}
          >
            <View style={styles.sheetHeader}>
              <Text variant="h3">{t("phone.chooseCountry")}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("common.cancel")}
                onPress={() => setPicking(false)}
                hitSlop={12}
              >
                <Icon name="close" />
              </Pressable>
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("phone.searchCountry")}
              placeholderTextColor={colors["text.subtle"]}
              style={[
                type.body,
                styles.search,
                {
                  color: colors["text.primary"],
                  backgroundColor: colors["bg.surface"],
                  borderColor: colors["border.default"],
                },
              ]}
            />
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onCountryChange(item.code);
                    setPicking(false);
                    setQuery("");
                  }}
                  style={styles.option}
                >
                  <Text style={styles.flagEmoji}>{flagEmoji(item.code)}</Text>
                  <Text variant="body" style={styles.optionName}>
                    {item.name}
                  </Text>
                  <Text variant="body" color="text.muted">
                    {item.dialCode}
                  </Text>
                </Pressable>
              )}
            />
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingRight: 14,
    gap: 14,
  },
  country: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 14,
    paddingRight: 12,
    height: "100%",
  },
  flag: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  flagEmoji: { fontSize: 20, lineHeight: 24 },
  divider: { width: 1, height: "100%", marginLeft: -14 },
  input: { flex: 1, height: "100%", paddingVertical: 0 },
  sheet: { flex: 1, paddingHorizontal: 20, gap: 12 },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
  },
  search: {
    height: 44,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  optionName: { flex: 1 },
});
