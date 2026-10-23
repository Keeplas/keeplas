import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";
import { G } from "react-native-svg";

/**
 * Ambient illustration motion, ported 1:1 from the keeplas-website SVGs
 * (`.ill-*` CSS keyframes). Generated illustrations wrap their moving parts
 * in <Ambient>; see scripts/gen-illustrations.mjs.
 */

/** True once we know the user has not asked to reduce motion. */
export function usePlayAmbient(): boolean {
  const [reduce, setReduce] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduce(value);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduce,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce === false;
}

type Keyframes = { transform: [string, string]; opacity?: [number, number] };

// `from` / `to` of each website keyframe, as SVG transforms in view-box units.
const KEYFRAMES = {
  sway: (x: number, y: number): Keyframes => ({
    transform: [`rotate(-1.5 ${x} ${y})`, `rotate(1.5 ${x} ${y})`],
  }),
  glow: (x: number, y: number): Keyframes => ({
    transform: [
      `translate(${x} ${y}) scale(0.92) translate(${-x} ${-y})`,
      `translate(${x} ${y}) scale(1.12) translate(${-x} ${-y})`,
    ],
    opacity: [0.7, 1],
  }),
  shimmer: (): Keyframes => ({
    transform: ["translate(0 0)", "translate(4 0)"],
    opacity: [1, 0.35],
  }),
  drift: (): Keyframes => ({
    transform: ["translate(-10 0)", "translate(10 0)"],
  }),
} as const;

export type AmbientKind = keyof typeof KEYFRAMES;

const AnimatedG = Animated.createAnimatedComponent(G);
const EASE = Easing.inOut(Easing.ease);

/**
 * One `.ill-*` group: `ease-in-out infinite alternate` over `duration`
 * seconds, started `delay` seconds into the cycle (the website's negative
 * animation-delay). SVG props can't use the native driver, so motion stays
 * on a handful of small groups. Still when `play` is false.
 */
export function Ambient({
  kind,
  origin = [0, 0],
  duration,
  delay = 0,
  play,
  children,
}: {
  kind: AmbientKind;
  /** Pivot in view-box units (sway: stem base, glow: centre). */
  origin?: readonly [number, number];
  duration: number;
  delay?: number;
  play: boolean;
  children: ReactNode;
}) {
  const [clock] = useState(() => new Animated.Value(0));
  const [x, y] = origin;

  useEffect(() => {
    if (!play) return;
    const loop = Animated.loop(
      Animated.timing(clock, {
        toValue: 1,
        duration: duration * 2000,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [play, clock, duration]);

  const props = useMemo(() => {
    const frames = KEYFRAMES[kind](x, y);
    // One clock tick = there and back; the phase replays the website delay.
    const t = Animated.modulo(
      Animated.add(clock, (delay / (duration * 2)) % 1),
      1,
    );
    const at = <T extends string | number>(from: T, to: T) =>
      t.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [from, to, from] as string[] | number[],
        easing: EASE,
      });
    return {
      transform: at(...frames.transform),
      opacity: frames.opacity ? at(...frames.opacity) : undefined,
    };
  }, [clock, kind, x, y, duration, delay]);

  if (!play) return <>{children}</>;
  return <AnimatedG {...props}>{children}</AnimatedG>;
}
