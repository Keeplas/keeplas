import { cn } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";
import { AuthScreen, authCardClass } from "@/components/auth-screen";
import { ContactForm } from "@/components/contact-form";

/**
 * Public account-deletion page, the URL given to Google Play (Data safety)
 * and App Store Connect: how to delete an account in the app, what is erased,
 * and a request form for people who no longer have the app. Support confirms
 * a request with the number on file, then runs
 * `account_deletion:scheduleForPhone` (apps/mobile/APP_REVIEW.md).
 */
export default function DeleteAccountPage() {
  const t = useTranslations("deleteAccount");

  return (
    <AuthScreen title={t("heroTitle")} body={t("heroBody")}>
      <div
        className={cn(
          authCardClass,
          "flex max-w-[520px] flex-col gap-[24px] p-[32px] shadow-card",
        )}
      >
        {/* AuthScreen hides its hero title below lg. */}
        <h1 className="text-h1 text-text-primary lg:hidden">{t("title")}</h1>
        <section className="flex flex-col gap-[12px]">
          <h2 className="text-h2 text-text-primary">{t("inApp.title")}</h2>
          <ol className="flex list-decimal flex-col gap-[8px] pl-[20px] text-body text-text-body">
            <li>{t("inApp.step1")}</li>
            <li>{t("inApp.step2")}</li>
            <li>{t("inApp.step3")}</li>
          </ol>
        </section>

        <section className="flex flex-col gap-[8px]">
          <h2 className="text-h3 text-text-primary">{t("erased.title")}</h2>
          <p className="text-body text-text-body">{t("erased.body")}</p>
          <p className="text-body-sm text-text-muted">{t("erased.kept")}</p>
        </section>

        <section className="flex flex-col gap-[16px] border-t border-border-default pt-[24px]">
          <div className="flex flex-col gap-[8px]">
            <h2 className="text-h3 text-text-primary">{t("noApp.title")}</h2>
            <p className="text-body text-text-body">{t("noApp.body")}</p>
          </div>
          <ContactForm initialTopic="account_deletion" />
        </section>
      </div>
    </AuthScreen>
  );
}
