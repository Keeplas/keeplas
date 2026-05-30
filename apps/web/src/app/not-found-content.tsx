"use client";

import Link from "next/link";
import { useTranslations } from "@/lib/i18n";

export function NotFoundContent() {
  const t = useTranslations("notFound");
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-display-lg text-primary">404</h1>
      <p className="text-body-lg text-on-surface-variant">{t("message")}</p>
      <Link
        href="/"
        className="mt-4 px-6 py-2 rounded-xl gradient-signature text-on-primary font-medium hover:opacity-90 transition-opacity"
      >
        {t("goHome")}
      </Link>
    </div>
  );
}
