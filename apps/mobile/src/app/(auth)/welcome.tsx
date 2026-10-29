import { useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import paintedLandscape from "../../../assets/images/landscape-painted.jpg";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { useI18n } from "@/providers/i18n-provider";
import { layout, welcomeSky, withAlpha } from "@/theme";

// Star field from the M08-1 spec: [x, y, size, opacity].
const STARS = [
  [38, 108, 3.2, 0.5],
  [168, 92, 2.4, 0.4],
  [262, 118, 2.8, 0.55],
  [352, 150, 3.6, 0.6],
  [300, 236, 2.4, 0.4],
  [372, 300, 2.8, 0.5],
  [30, 356, 2.4, 0.35],
  [214, 392, 2.8, 0.45],
  [344, 404, 2.4, 0.4],
  [120, 418, 2, 0.35],
] as const;

const LANDSCAPE_RATIO = 1080 / 638;
const ACTIONS_OVERLAP = 24;
// The hero is already display-sized: past this, accessibility text sizes
// would leave room for little else.
const HERO_MAX_SCALE = 1.5;

function skyLocations(top: number, height: number, screenHeight: number) {
  const [, upper, middle, horizon] = welcomeSky.locations;
  const horizonAt = top / screenHeight;
  const scale = horizonAt / horizon;
  return [
    0,
    upper * scale,
    middle * scale,
    horizonAt,
    (top + height) / screenHeight,
    1,
  ] as const;
}

/** M08-1 Welcome: night sky over the painted landscape, same in both themes. */
export default function Welcome() {
  const router = useRouter();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState({ width: 0, height: 0 });
  const [contentBottom, setContentBottom] = useState(0);
  const [actionsTop, setActionsTop] = useState(0);
  const landscapeHeight = screen.width / LANDSCAPE_RATIO;
  const landscapeTop = Math.max(
    actionsTop + ACTIONS_OVERLAP - landscapeHeight,
    contentBottom,
  );
  const measured = screen.height > 0 && actionsTop > 0;

  return (
    <View style={styles.root} onLayout={(e) => setScreen(e.nativeEvent.layout)}>
      <StatusBar style="light" />
      <LinearGradient
        colors={welcomeSky.colors}
        locations={
          measured
            ? skyLocations(landscapeTop, landscapeHeight, screen.height)
            : welcomeSky.locations
        }
        style={StyleSheet.absoluteFill}
      />
      {measured ? (
        <View
          pointerEvents="none"
          style={[
            styles.landscape,
            { top: landscapeTop, height: landscapeHeight },
          ]}
        >
          <Image
            source={paintedLandscape}
            style={{ width: screen.width, height: landscapeHeight }}
            resizeMode="cover"
          />
          <LinearGradient
            colors={[welcomeSky.horizon, withAlpha(welcomeSky.horizon, 0)]}
            style={styles.fadeTop}
          />
          <LinearGradient
            colors={[withAlpha(welcomeSky.ground, 0), welcomeSky.ground]}
            style={styles.fadeBottom}
          />
        </View>
      ) : null}
      {STARS.map(([x, y, size, opacity]) => (
        <View
          key={`${x}-${y}`}
          style={[
            styles.star,
            {
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity,
            },
          ]}
        />
      ))}
      {/* Scrolls only when large text sizes push the buttons off-screen. */}
      <ScrollView
        style={styles.safe}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
      >
        <AppHeader inverse />
        <View
          style={styles.content}
          onLayout={(e) => {
            const { y, height } = e.nativeEvent.layout;
            setContentBottom(y + height);
          }}
        >
          <Text
            variant="hero"
            style={styles.white}
            maxFontSizeMultiplier={HERO_MAX_SCALE}
          >
            {t("welcome.title")}
          </Text>
          <Text variant="lead" style={[styles.white, styles.lead]}>
            {t("welcome.body")}
          </Text>
        </View>
        <View
          style={styles.actions}
          onLayout={(e) => setActionsTop(e.nativeEvent.layout.y)}
        >
          <Button
            variant="glass"
            label={t("welcome.getStarted")}
            chevron
            onPress={() =>
              router.push({ pathname: "/phone", params: { intent: "signup" } })
            }
          />
          <Button
            variant="glass"
            label={t("welcome.haveAccount")}
            onPress={() =>
              router.push({ pathname: "/phone", params: { intent: "signin" } })
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: welcomeSky.ground },
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  star: { position: "absolute", backgroundColor: welcomeSky.foreground },
  landscape: { position: "absolute", left: 0, right: 0 },
  fadeTop: { position: "absolute", top: 0, left: 0, right: 0, height: 44 },
  fadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
  },
  content: { paddingHorizontal: layout.gutter, paddingTop: 31, gap: 16 },
  white: { color: welcomeSky.foreground },
  lead: { opacity: 0.9 },
  actions: {
    marginTop: "auto",
    paddingHorizontal: layout.gutter,
    paddingBottom: 24,
    gap: 12,
  },
});
