import { useTranslations } from "@/lib/i18n";
import { ICON_PATHS } from "@/lib/icons";
import { AuthScreen } from "@/components/auth-screen";
import { StateMessage } from "@/components/state-message";
import { StoreBadges } from "@/components/store-badges";

/**
 * Path of the W04-2 QR code (`/link#s=…&h=…`). Only the Keeplas app may act on
 * it: a phone camera that opens it in a browser lands here, and the page never
 * reads the hash.
 */
export default function LinkPage() {
  const t = useTranslations("getApp");
  return (
    <AuthScreen title={t("heroTitle")} body={t("heroBody")}>
      <StateMessage
        icon={ICON_PATHS.qr}
        title={t("scanInApp.title")}
        body={t("scanInApp.body")}
      >
        <StoreBadges />
      </StateMessage>
    </AuthScreen>
  );
}
