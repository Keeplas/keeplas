import { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { BottomSheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { radius, type } from "@/theme";
import { searchIcons } from "./icon-catalog";

export function IconPicker({
  visible,
  value,
  onChange,
  onDismiss,
}: {
  visible: boolean;
  value?: IconName;
  onChange: (icon: IconName | undefined) => void;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const icons = useMemo(() => searchIcons(query), [query]);

  function pick(icon: IconName | undefined) {
    onChange(icon);
    setQuery("");
    onDismiss();
  }

  const cell = (selected: boolean) => [
    styles.cell,
    {
      backgroundColor: selected ? colors["bg.info"] : colors["bg.surface"],
      borderColor: selected ? colors["border.focus"] : colors["border.default"],
    },
  ];

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      title={t("capture.iconLabel")}
    >
      <View
        style={[
          styles.search,
          {
            backgroundColor: colors["bg.surface"],
            borderColor: colors["border.default"],
          },
        ]}
      >
        <Icon name="search" size={18} color="text.muted" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("capture.iconSearch")}
          placeholderTextColor={colors["text.subtle"]}
          accessibilityLabel={t("capture.iconSearch")}
          autoCorrect={false}
          style={[type.body, styles.input, { color: colors["text.primary"] }]}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: !value }}
        onPress={() => pick(undefined)}
        style={[cell(!value), styles.auto]}
      >
        <Icon name="flash" size={20} color="text.primary" />
        <View style={styles.flex}>
          <Text variant="label">{t("capture.iconAuto")}</Text>
          <Text variant="body-sm" color="text.muted">
            {t("capture.iconAutoBody")}
          </Text>
        </View>
      </Pressable>
      {icons.length === 0 ? (
        <Text variant="body-sm" color="text.muted" align="center">
          {t("capture.iconNone")}
        </Text>
      ) : (
        <View style={styles.grid}>
          {icons.map((icon) => (
            <Pressable
              key={icon.name}
              accessibilityRole="button"
              accessibilityLabel={icon.words[0]}
              accessibilityState={{ selected: icon.name === value }}
              onPress={() => pick(icon.name)}
              style={cell(icon.name === value)}
            >
              <Icon name={icon.name} size={22} color="text.primary" />
            </Pressable>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  input: { flex: 1, paddingVertical: 0 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: radius.md,
  },
  auto: {
    width: "100%",
    height: undefined,
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 12,
    padding: 12,
  },
});
