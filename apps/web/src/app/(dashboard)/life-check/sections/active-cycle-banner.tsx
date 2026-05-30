"use client";

import { useTranslations } from "@/lib/i18n";

interface ActiveCycleBannerProps {
  status: string;
  onValidate: () => void;
  onPostpone: (duration: "48h" | "7d") => void;
}

export function ActiveCycleBanner({
  status,
  onValidate,
  onPostpone,
}: ActiveCycleBannerProps) {
  const t = useTranslations("lifeCheck");
  return (
    <div className="mb-8 bg-primary-container text-on-primary-container rounded-2xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-headline-sm text-on-primary mb-1">
            {t("activeCycle.title")}
          </h3>
          <p className="text-body-md text-on-primary-container/90">
            {status === "running"
              ? t("activeCycle.runningDescription")
              : t("activeCycle.escalatingDescription")}
          </p>
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <button
          onClick={onValidate}
          className="bg-secondary-fixed text-on-secondary-fixed font-bold py-2.5 px-5 rounded-xl text-sm cursor-pointer hover:scale-[1.02] transition-transform"
        >
          {t("activeCycle.imWell")}
        </button>
        <button
          onClick={() => onPostpone("48h")}
          className="bg-surface-container-lowest/10 text-on-primary border border-on-primary/20 font-bold py-2.5 px-5 rounded-xl text-sm cursor-pointer"
        >
          {t("activeCycle.postpone48h")}
        </button>
      </div>
    </div>
  );
}
