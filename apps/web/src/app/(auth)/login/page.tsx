import { useState } from "react";
import {
  Button,
  buttonVariants,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Icon,
} from "@keeplas/ui";
import { Link } from "@/lib/navigation";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { AuthScreen, authCardClass } from "@/components/auth-screen";

/** W04-1: link this browser from the phone (W04-2). */
export default function SignInPage() {
  const t = useTranslations("auth.signIn");
  const [lostAccessOpen, setLostAccessOpen] = useState(false);

  return (
    <AuthScreen title={t("heroTitle")} body={t("heroBody")}>
      <div
        className={cn(
          authCardClass,
          "flex max-w-[456px] flex-col gap-[14px] p-[32px] shadow-card",
        )}
      >
        <h2 className="text-h2 text-text-primary">{t("title")}</h2>
        <p className="text-body text-text-muted">{t("body")}</p>
        <Link
          href="/connect"
          className={cn(
            buttonVariants({ variant: "primary", size: "cta" }),
            "w-full",
          )}
        >
          {t("linkWithPhone")}
          <Icon path={ICON_PATHS.chevronRight} className="size-[20px]" />
        </Link>
        <Button
          variant="link"
          onClick={() => setLostAccessOpen(true)}
          className="h-[24px] text-button text-text-link"
        >
          {t("lostAccess")}
        </Button>
        <div className="mt-[4px] flex justify-center gap-[6px] border-t border-border-default pt-[14px] text-body-sm">
          <span className="text-text-muted">{t("newVisitor")}</span>
          <Link
            href="/get-the-app"
            className="font-semibold text-text-link underline underline-offset-2"
          >
            {t("getTheApp")}
          </Link>
        </div>
      </div>

      <Dialog open={lostAccessOpen} onOpenChange={setLostAccessOpen}>
        <DialogContent className="flex max-w-[456px] flex-col gap-[16px] rounded-xl border border-border-default bg-bg-surface p-[32px]">
          <DialogTitle className="text-h2 text-text-primary">
            {t("lostAccessDialog.title")}
          </DialogTitle>
          <DialogDescription className="text-body text-text-muted">
            {t("lostAccessDialog.body")}
          </DialogDescription>
          <Link
            href="/get-the-app"
            className={cn(
              buttonVariants({ variant: "primary", size: "cta" }),
              "mt-[8px] w-full",
            )}
          >
            {t("getTheApp")}
          </Link>
          <Button
            variant="link"
            onClick={() => setLostAccessOpen(false)}
            className="text-button"
          >
            {t("lostAccessDialog.close")}
          </Button>
        </DialogContent>
      </Dialog>
    </AuthScreen>
  );
}
