import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance as NativeAppearance, useColorScheme } from "react-native";

import { readPreference, writePreference } from "@/lib/preferences";
import { semantic, type ColorScheme, type SemanticColors } from "@/theme";

export const APPEARANCES = ["system", "light", "dark"] as const;
export type Appearance = (typeof APPEARANCES)[number];

interface ThemeValue {
  scheme: ColorScheme;
  colors: SemanticColors;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

/** Light / dark (Noir) following the system unless overridden (D10). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [appearance, setAppearanceState] = useState<Appearance>("system");

  useEffect(() => {
    readPreference("appearance").then((stored) => {
      if (APPEARANCES.includes(stored as Appearance)) {
        setAppearanceState(stored as Appearance);
      }
    });
  }, []);

  // Native UI (alerts, keyboard, pickers) follows the in-app choice too;
  // "unspecified" hands it back to the OS. The native splash before JS loads
  // still follows the OS.
  useEffect(() => {
    NativeAppearance.setColorScheme(
      appearance === "system" ? "unspecified" : appearance,
    );
  }, [appearance]);

  const value = useMemo<ThemeValue>(() => {
    const scheme: ColorScheme =
      appearance === "system"
        ? system === "dark"
          ? "dark"
          : "light"
        : appearance;
    return {
      scheme,
      colors: semantic[scheme],
      appearance,
      setAppearance: (next) => {
        setAppearanceState(next);
        void writePreference("appearance", next);
      },
    };
  }, [appearance, system]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
