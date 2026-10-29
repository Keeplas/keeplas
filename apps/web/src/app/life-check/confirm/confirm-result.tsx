import type { ReactNode } from "react";
import { Link } from "@/lib/navigation";
import { Button, buttonVariants } from "@keeplas/ui";
import { MobileBrand } from "../../(auth)/components/mobile-brand";
import { useTranslations } from "@/lib/i18n";

const fullWidthAction = buttonVariants({
  variant: "primary",
  size: "cta",
  className: "w-full",
});

/** Card shell shared by the confirm prompt and its outcome. */
function ConfirmCard({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  const t = useTranslations("lifeCheckConfirm");
  return (
    <section className="flex-1 flex items-center justify-center p-8 md:p-10 lg:p-12 xl:p-16 relative bg-bg-app md:overflow-y-auto">
      <MobileBrand />
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-bg-surface border border-border-default rounded-xs mb-4">
            <span className="text-caption text-text-primary">{t("badge")}</span>
          </div>
          <h3 className="text-h2 text-text-primary mb-2">{title}</h3>
          <p className="text-body text-text-muted">{body}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

/**
 * The page never confirms on load (mail scanners open links): the user has to
 * press this button.
 */
export function ConfirmPrompt({
  pending,
  onConfirm,
}: {
  pending: boolean;
  onConfirm: () => void;
}) {
  const t = useTranslations("lifeCheckConfirm");
  return (
    <ConfirmCard title={t("promptTitle")} body={t("promptBody")}>
      <Button
        variant="primary"
        size="cta"
        className="w-full"
        disabled={pending}
        onClick={onConfirm}
      >
        {t("confirm")}
      </Button>
    </ConfirmCard>
  );
}

export function ConfirmResult({ ok }: { ok: boolean }) {
  const t = useTranslations("lifeCheckConfirm");
  return (
    <ConfirmCard
      title={ok ? t("okTitle") : t("invalidTitle")}
      body={ok ? t("okBody") : t("invalidBody")}
    >
      <Link href="/life-check" className={fullWidthAction}>
        {t("openApp")}
      </Link>
    </ConfirmCard>
  );
}
