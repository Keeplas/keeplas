"use client";

import Link from "next/link";
import { buttonVariants } from "@keeplas/ui";
import { MobileBrand } from "../../(auth)/components/mobile-brand";
import { useTranslations } from "@/lib/i18n";

export function ConfirmResult({ ok }: { ok: boolean }) {
  const t = useTranslations("lifeCheckConfirm");
  return (
    <section className="flex-1 flex items-center justify-center p-8 md:p-10 lg:p-12 xl:p-16 relative bg-surface md:overflow-y-auto">
      <MobileBrand />
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-surface-container-lowest rounded-full mb-4 shadow-sm">
            <span className="text-label-md text-primary">{t("badge")}</span>
          </div>
          <h3 className="text-headline-md text-primary mb-2">
            {ok ? t("okTitle") : t("invalidTitle")}
          </h3>
          <p className="text-body-md text-on-surface-variant">
            {ok ? t("okBody") : t("invalidBody")}
          </p>
        </div>
        <Link
          href="/life-check"
          className={buttonVariants({
            variant: "vault",
            size: "md",
            className: "w-full",
          })}
        >
          {t("openApp")}
        </Link>
      </div>
    </section>
  );
}
