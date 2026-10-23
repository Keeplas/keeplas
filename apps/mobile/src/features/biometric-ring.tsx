import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";

import { usePlayAmbient } from "@/components/ambient";
import { Icon } from "@/components/icon";
import { useTheme } from "@/providers/theme-provider";
import { withAlpha } from "@/theme";

// Proportions of the Figma `Illustration/face|fingerprint` frame (240 grid).
const OUTER = 224 / 240;
const MIDDLE = 176 / 240;
const DISC = 128 / 240;
const GLYPH = 0.24;

/**
 * The biometric illustrations (M01-3 face, M08-6 fingerprint): a theme-aware
 * disc holding the kit glyph, with two sky rings that breathe softly. The
 * loop runs on the native driver and stays still under Reduce Motion.
 */
export function BiometricRing({
  kind,
  size = 240,
}: {
  kind: "face" | "fingerprint";
  size?: number;
}) {
  const { colors } = useTheme();
  const [pulse] = useState(() => new Animated.Value(0));
  const play = usePlayAmbient();

  useEffect(() => {
    if (!play) return;
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [play, pulse]);

  // The middle ring swells first, the outer one follows: a slow ripple.
  const ring = (diameter: number, alpha: number, peak: number) => {
    const style: Animated.WithAnimatedValue<ViewStyle> = {
      width: diameter,
      height: diameter,
      borderRadius: diameter / 2,
      backgroundColor: withAlpha(colors.accent, alpha),
      opacity: pulse.interpolate({
        inputRange: [0, peak, 1],
        outputRange: [0.7, 1, 0.7],
      }),
      transform: [
        {
          scale: pulse.interpolate({
            inputRange: [0, peak, 1],
            outputRange: [1, 1.05, 1],
          }),
        },
      ],
    };
    return <Animated.View style={[styles.layer, style]} />;
  };

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      {ring(size * OUTER, 0.06, 0.6)}
      {ring(size * MIDDLE, 0.09, 0.4)}
      <View
        style={[
          styles.layer,
          {
            width: size * DISC,
            height: size * DISC,
            borderRadius: (size * DISC) / 2,
            backgroundColor: colors["bg.surface"],
            borderColor: colors["control.border"],
          },
          styles.disc,
        ]}
      >
        <Icon
          name={kind === "face" ? "face-id" : "fingerprint"}
          size={size * GLYPH}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  layer: { position: "absolute" },
  disc: {
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
