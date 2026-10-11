import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import MarkInverse from "../../assets/logo/mark-inverse.svg";
import Mark from "../../assets/logo/mark.svg";
import { useI18n } from "@/providers/i18n-provider";
import { useTheme } from "@/providers/theme-provider";
import { layout, welcomeSky } from "@/theme";
import { Icon } from "./icon";
import { LanguageDropdown } from "./language";
import { Text } from "./text";

/**
 * Figma `App Header` (52 pt): optional back chevron, logo mark + "Keeplas"
 * (H3), language dropdown on the right unless `right` replaces it.
 * `inverse` is the white variant over the M08-1 night sky.
 */
export function AppHeader({
  onBack,
  right,
  inverse = false,
}: {
  onBack?: () => void;
  right?: ReactNode;
  inverse?: boolean;
}) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  const LogoMark = inverse || scheme === "dark" ? MarkInverse : Mark;
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            onPress={onBack}
            hitSlop={12}
            style={styles.back}
          >
            <Icon name="chevron-left" />
          </Pressable>
        ) : null}
        <View style={styles.brand}>
          <LogoMark width={30} height={30} />
          <Text
            variant="h3"
            style={inverse ? { color: welcomeSky.foreground } : undefined}
          >
            {t("common.appName")}
          </Text>
        </View>
      </View>
      {right ?? <LanguageDropdown inverse={inverse} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: layout.headerHeight,
    paddingHorizontal: layout.gutter,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  back: { marginLeft: -4, marginRight: 8 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
});
