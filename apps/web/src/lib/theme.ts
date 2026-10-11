import { useEffect } from "react";
import { STORAGE_KEYS } from "./storage-keys";
import { useLocalStorageString } from "./use-local-storage-state";

export type Theme = "light" | "dark";

/**
 * Light or dark (Noir) theme, saved on this browser. Light by default: the
 * screens not yet rebuilt on the v2 semantic tokens are light-only.
 */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [raw, setRaw] = useLocalStorageString(STORAGE_KEYS.theme, "light");
  return [raw === "dark" ? "dark" : "light", setRaw];
}

/** Mirrors the saved theme onto `<html class="dark">`. Renders nothing. */
export function ThemeSync() {
  const [theme] = useTheme();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  return null;
}
