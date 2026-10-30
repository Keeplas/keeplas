import { useId } from "react";
import { usePreventScreenCapture } from "expo-screen-capture";

/**
 * Screenshots and screen recordings show nothing while the calling screen is
 * mounted (Android: FLAG_SECURE, which also blanks the app in Recents). For
 * the 24 words and decrypted items. Each caller holds its own key, so
 * closing one protected screen keeps the one below it protected.
 */
export function useNoScreenCapture(): void {
  usePreventScreenCapture(useId());
}
