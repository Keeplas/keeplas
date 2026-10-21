import { memo, type ReactNode } from "react";
import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import Branch from "../../assets/illustrations/branch.svg";
import LandscapeNight from "../../assets/illustrations/landscape-night.svg";
import Landscape from "../../assets/illustrations/landscape.svg";
import { useTheme } from "@/providers/theme-provider";
import { useTabBarVisible } from "./tab-bar";
import { layout } from "@/theme";

export type ScreenDecor = "branches" | "landscape";

/**
 * Screen frame shared by every page: `bg/app`, safe areas, an App Header
 * slot, scrollable content (20 pt gutter, 12 pt under the header) and the
 * Figma decor (`Decor/branch` corners or `Decor/landscape` footer).
 */
export function Screen({
  header,
  children,
  footer,
  decor,
  gap = 16,
  center = false,
  scroll = true,
  contentStyle,
}: {
  header?: ReactNode;
  children: ReactNode;
  /** Pinned under the scroll area (bottom actions). */
  footer?: ReactNode;
  decor?: ScreenDecor;
  gap?: number;
  center?: boolean;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}) {
  const { colors, scheme } = useTheme();
  const tabBar = useTabBarVisible();
  const content: ViewStyle[] = [
    styles.content,
    { gap },
    center ? styles.center : {},
    contentStyle ?? {},
  ];
  return (
    <SafeAreaView
      edges={tabBar ? ["top"] : ["top", "bottom"]}
      style={[styles.root, { backgroundColor: colors["bg.app"] }]}
    >
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {decor ? <Decor kind={decor} night={scheme === "dark"} /> : null}
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, ...content, styles.listOwnsBottom]}>
          {children}
        </View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

// The decor SVGs are big component trees (clipPaths, dozens of paths); memo
// keeps them out of every Screen re-render.
const Decor = memo(function Decor({
  kind,
  night,
}: {
  kind: ScreenDecor;
  night: boolean;
}) {
  if (kind === "landscape") {
    const Art = night ? LandscapeNight : Landscape;
    return (
      <View pointerEvents="none" style={styles.landscape}>
        <Art width="100%" height={246} preserveAspectRatio="xMidYMax slice" />
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={styles.branches}>
      <Branch width={130} height={130} opacity={0.9} />
      <Branch width={130} height={130} opacity={0.9} style={styles.flipped} />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: layout.gutter,
    paddingTop: 12,
    paddingBottom: 24,
  },
  center: { alignItems: "center" },
  listOwnsBottom: { paddingBottom: 0 },
  footer: { paddingHorizontal: layout.gutter, paddingBottom: 12, gap: 12 },
  landscape: { position: "absolute", left: 0, right: 0, bottom: 0 },
  branches: {
    position: "absolute",
    left: -10,
    right: -10,
    bottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  flipped: { transform: [{ scaleX: -1 }] },
});
