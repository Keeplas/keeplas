import { Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import paintedLandscape from "../../../assets/images/landscape-painted.jpg";
import LandscapeNight from "../../../assets/illustrations/landscape-night.svg";
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

/** M08-1 Welcome: night sky over the painted landscape, same in both themes. */
export default function Welcome() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={welcomeSky.colors}
        locations={welcomeSky.locations}
        style={StyleSheet.absoluteFill}
      />
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
      <View pointerEvents="none" style={styles.landscape}>
        <LandscapeNight width={640} height={400} style={styles.landscapeSvg} />
        <Image
          source={paintedLandscape}
          style={styles.painted}
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
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <AppHeader inverse />
        <View style={styles.content}>
          <Text variant="hero" style={styles.white}>
            {t("welcome.title")}
          </Text>
          <Text variant="lead" style={[styles.white, styles.lead]}>
            {t("welcome.body")}
          </Text>
        </View>
        <View style={styles.actions}>
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
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: welcomeSky.ground },
  safe: { flex: 1 },
  star: { position: "absolute", backgroundColor: welcomeSky.foreground },
  // The landscape block is anchored to the bottom (852 pt frame: 470..702).
  landscape: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 150,
    height: 232,
  },
  landscapeSvg: { position: "absolute", left: -120, top: -18 },
  painted: { width: "100%", height: 232 },
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
