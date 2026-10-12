import { buttonVariants, cn } from "@keeplas/ui";
import { Link } from "@/lib/navigation";
import { useTranslations } from "@/lib/i18n";
import { AuthScreen, authCardClass } from "@/components/auth-screen";
import { QRCodeSVG } from "@/components/qr-code-svg";
import { StoreBadges } from "@/components/store-badges";

/** D-01: sign-up is mobile-only, so a desktop visitor is sent to the app. */
export default function GetTheAppPage() {
  const t = useTranslations("getApp");
  const downloadUrl = `${window.location.origin}/download`;

  return (
    <AuthScreen title={t("heroTitle")} body={t("heroBody")}>
      <div
        className={cn(
          authCardClass,
          "flex max-w-[456px] flex-col items-center gap-[16px] p-[32px] text-center shadow-card",
        )}
      >
        <h2 className="text-h2 text-text-primary">{t("title")}</h2>
        <p className="text-body text-text-muted">{t("body")}</p>
        <div className="rounded-md border border-border-default bg-bg-surface p-[12px]">
          <QRCodeSVG value={downloadUrl} size={160} />
        </div>
        <p className="text-body-sm text-text-muted">{t("scan")}</p>
        <StoreBadges />
        <div className="flex w-full flex-col gap-[16px] border-t border-border-default pt-[16px]">
          <p className="text-body-sm text-text-muted">{t("haveApp")}</p>
          <Link
            href="/connect"
            className={cn(
              buttonVariants({ variant: "outlined", size: "cta" }),
              "w-full",
            )}
          >
            {t("linkWithPhone")}
          </Link>
        </div>
      </div>
    </AuthScreen>
  );
}
