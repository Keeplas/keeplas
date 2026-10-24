import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import MarkInverse from "../../assets/logo/mark-inverse.svg";
import Mark from "../../assets/logo/mark.svg";
import { STAGE_HOME } from "@/lib/session-stage";
import { useI18n } from "@/providers/i18n-provider";
import { useSession } from "@/providers/session-provider";
import { useTheme } from "@/providers/theme-provider";
import { layout, welcomeSky } from "@/theme";
import { Icon } from "./icon";
import { LanguageDropdown } from "./language";
import { Text } from "./text";

/**
 * Figma `App Header` (52 pt): optional back chevron, logo mark + "Keeplas"
 * (H3), language dropdown on the right unless `right` replaces it.
 * The logo leads to the current stage's first screen, except mid-setup
 * where leaving would skip the recovery kit.
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
  const router = useRouter();
  const { t } = useI18n();
  const { stage, settingUp } = useSession();
  const home = stage === "loading" || settingUp ? null : STAGE_HOME[stage];
  const LogoMark = inverse || scheme === "dark" ? MarkInverse : Mark;
  // Like the tab bar: `dismissTo` alone can't switch tabs (from People or
  // Settings it was a no-op), so pop the stack, then navigate.
  const goHome = () => {
    if (!home) return;
    if (router.canDismiss()) router.dismissAll();
    router.navigate(home);
  };
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
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("common.appName")}
          disabled={!home}
          onPress={goHome}
          style={styles.brand}
        >
          <LogoMark width={30} height={30} />
          <Text
            variant="h3"
            style={inverse ? { color: welcomeSky.foreground } : undefined}
          >
            {t("common.appName")}
          </Text>
        </Pressable>
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
