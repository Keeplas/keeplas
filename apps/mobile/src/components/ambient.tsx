import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";
import { G, type GProps } from "react-native-svg";

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

type Matrix = [number, number, number, number, number, number];

const rotate = (deg: number, x: number, y: number): Matrix => {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [cos, sin, -sin, cos, x - cos * x + sin * y, y - sin * x - cos * y];
};

const scale = (k: number, x: number, y: number): Matrix => [
  k,
  0,
  0,
  k,
  x - k * x,
  y - k * y,
];

const translate = (tx: number): Matrix => [1, 0, 0, 1, tx, 0];

const KEYFRAMES = {
  sway: { from: -1.5, to: 1.5, matrix: rotate },
  glow: { from: 0.92, to: 1.12, matrix: scale, opacity: [0.7, 1] },
  shimmer: { from: 0, to: 4, matrix: translate, opacity: [1, 0.35] },
  drift: { from: -10, to: 10, matrix: translate },
} satisfies Record<
  string,
  {
    from: number;
    to: number;
    matrix: (value: number, x: number, y: number) => Matrix;
    opacity?: [number, number];
  }
>;

export type AmbientKind = keyof typeof KEYFRAMES;

const EASE = Easing.inOut(Easing.ease);

export function ambientFrame(
  kind: AmbientKind,
  [x, y]: readonly [number, number],
  t: number,
): { matrix: Matrix; opacity?: number } {
  const frames = KEYFRAMES[kind];
  const progress = t < 0.5 ? EASE(t * 2) : 1 - EASE(t * 2 - 1);
  const mix = (from: number, to: number) => from + (to - from) * progress;
  return {
    matrix: frames.matrix(mix(frames.from, frames.to), x, y),
    opacity: "opacity" in frames ? mix(...frames.opacity) : undefined,
  };
}

export function Ambient({
  kind,
  origin = [0, 0],
  duration,
  delay = 0,
  play,
  children,
}: {
  kind: AmbientKind;
  origin?: readonly [number, number];
  duration: number;
  delay?: number;
  play: boolean;
  children: ReactNode;
}) {
  const group = useRef<G<GProps>>(null);
  const [x, y] = origin;

  useEffect(() => {
    if (!play) return;
    const clock = new Animated.Value(0);
    const phase = (delay / (duration * 2)) % 1;
    const listener = clock.addListener(({ value }) => {
      const { matrix, opacity } = ambientFrame(
        kind,
        [x, y],
        (value + phase) % 1,
      );
      group.current?.setNativeProps(
        opacity === undefined ? { matrix } : { matrix, opacity },
      );
    });
    const loop = Animated.loop(
      Animated.timing(clock, {
        toValue: 1,
        duration: duration * 2000,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      clock.removeListener(listener);
    };
  }, [play, kind, x, y, duration, delay]);

  if (!play) return <>{children}</>;
  return <G ref={group}>{children}</G>;
}
