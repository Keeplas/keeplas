import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, useColorScheme } from "react-native";
import * as SplashScreen from "expo-splash-screen";

import MarkInverse from "../../assets/logo/mark-inverse.svg";
import Mark from "../../assets/logo/mark.svg";
import { semantic, splash } from "@/theme";
import { usePlayAmbient } from "./ambient";

const SIZE = splash.logoWidth;

/**
 * The native splash, brought to life. Same background, logo and size as
 * app.json's `expo-splash-screen` (both start on the system scheme; this one
 * then follows Settings → Appearance once ThemeProvider has loaded it), so the
 * hand-off is seamless: once laid out it hides the native splash, then the
 * shield breathes and a sky halo ripples out while `visible`. Still under
 * Reduce Motion. Fades out, then unmounts, when `visible` turns false.
 */
export function BootSplash({ visible }: { visible: boolean }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const play = usePlayAmbient();
  const [pulse] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!play || !visible) return;
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2000,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [play, visible, pulse]);

  useEffect(() => {
    if (visible) return;
    const out = Animated.timing(fade, {
      toValue: 0,
      duration: 240,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    out.start(({ finished }) => {
      if (finished) setDone(true);
    });
    return () => out.stop();
  }, [visible, fade]);

  if (done) return null;
  const Logo = scheme === "dark" ? MarkInverse : Mark;
  return (
    <Animated.View
      testID="boot-splash"
      pointerEvents={visible ? "auto" : "none"}
      onLayout={() => void SplashScreen.hideAsync()}
      style={[
        StyleSheet.absoluteFill,
        styles.frame,
        { backgroundColor: splash[scheme], opacity: fade },
      ]}
    >
      <Animated.View
        style={[
          styles.halo,
          {
            borderColor: semantic[scheme].accent,
            opacity: pulse.interpolate({
              inputRange: [0, 0.2, 1],
              outputRange: [0, 0.5, 0],
            }),
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1.6],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={{
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.05, 1],
              }),
            },
          ],
        }}
      >
        <Logo width={SIZE} height={SIZE} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: "center", justifyContent: "center" },
  halo: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
  },
});
