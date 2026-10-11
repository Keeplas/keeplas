import { countryName, formatTime } from "@/lib/format";
import { useI18n } from "@/providers/i18n-provider";
import { describeUserAgent } from "./qr-flow";

/** "Chrome on macOS", "France", "Today at 9:41 AM" for a pairing session. */
export function usePairingLabels(
  userAgent: string,
  country: string,
  at: number,
) {
  const { t, language } = useI18n();
  const { browser, os } = describeUserAgent(userAgent);
  const device =
    browser && os
      ? t("linkBrowser.deviceOn", { browser, os })
      : (browser ?? os ?? t("linkBrowser.unknownBrowser"));
  const location =
    country && country !== "unknown"
      ? countryName(country, language)
      : t("linkBrowser.unknownLocation");
  return {
    device,
    location,
    time: t("linkBrowser.today", { time: formatTime(at, language) }),
  };
}
