import {
  createContext,
  memo,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Keyboard, StyleSheet, View, type ViewStyle } from "react-native";
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
  KeyboardStickyView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import Branch from "../../assets/illustrations/branch.svg";
import LandscapeNight from "../../assets/illustrations/landscape-night.svg";
import Landscape from "../../assets/illustrations/landscape.svg";
import { useTheme } from "@/providers/theme-provider";
import { Lake, LakeNight } from "./illustrations.generated";
import { useTabBarVisible } from "./tab-bar";
import { layout } from "@/theme";

export type ScreenDecor = "branches" | "landscape" | "lake";

const KEYBOARD_GAP = 24;

const RevealContext = createContext<(view: View | null) => void>(() => {});

export const useRevealAboveKeyboard = () => useContext(RevealContext);

// Footer art per decor: [light, night]. `lake` is the website landscape
// (foliage, pines, lake) with its ambient motion; `landscape` the flat one.
const FOOTER_ART = {
  landscape: [Landscape, LandscapeNight],
  lake: [Lake, LakeNight],
} as const;

/**
 * Screen frame shared by every page: `bg/app`, safe areas, an App Header
 * slot, scrollable content (20 pt gutter, 12 pt under the header) and the
 * Figma decor (`Decor/branch` corners or a landscape footer).
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
  const insets = useSafeAreaInsets();
  const [footerHeight, setFooterHeight] = useState(0);
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const offset = useRef(0);
  const reveal = useCallback(
    (view: View | null) => {
      const run = () => {
        const keyboard = Keyboard.metrics();
        const frame = scrollRef.current;
        if (!view || !keyboard || !frame) return;
        view.measureInWindow((_x, top, _width, height) => {
          const limit =
            keyboard.screenY - KEYBOARD_GAP - (footer ? footerHeight : 0);
          const below = top + height - limit;
          if (below > 0) {
            frame.scrollTo({ y: offset.current + below, animated: true });
          }
        });
      };
      if (Keyboard.isVisible()) {
        run();
        return;
      }
      const subscription = Keyboard.addListener("keyboardDidShow", () => {
        subscription.remove();
        run();
      });
    },
    [footer, footerHeight],
  );
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
      {decor && decor !== "branches" ? (
        <Decor kind={decor} night={scheme === "dark"} />
      ) : null}
      {header}
      {scroll ? (
        <RevealContext.Provider value={reveal}>
          <KeyboardAwareScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={content}
            bottomOffset={KEYBOARD_GAP + (footer ? footerHeight : 0)}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={32}
            onScroll={(event) => {
              offset.current = event.nativeEvent.contentOffset.y;
            }}
          >
            {children}
            {decor === "branches" ? (
              <Decor kind={decor} night={scheme === "dark"} />
            ) : null}
          </KeyboardAwareScrollView>
          {footer ? (
            <KeyboardStickyView
              offset={{ opened: tabBar ? 0 : insets.bottom }}
              onLayout={(event) =>
                setFooterHeight(event.nativeEvent.layout.height)
              }
              style={[
                styles.footer,
                decor ? null : { backgroundColor: colors["bg.app"] },
              ]}
            >
              {footer}
            </KeyboardStickyView>
          ) : null}
        </RevealContext.Provider>
      ) : (
        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <View style={[styles.flex, ...content, styles.listOwnsBottom]}>
            {children}
          </View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </KeyboardAvoidingView>
      )}
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
  if (kind !== "branches") {
    const Art = FOOTER_ART[kind][night ? 1 : 0];
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
    marginTop: "auto",
    marginHorizontal: -layout.gutter - 10,
    marginBottom: -24,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  flipped: { transform: [{ scaleX: -1 }] },
});
