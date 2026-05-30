"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

export function BackButton() {
  const router = useRouter();
  const c = useTranslations("common");

  const handleClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 text-label-md text-on-surface-variant hover:text-secondary transition-colors group"
    >
      <Icon
        path={ICON_PATHS.arrowLeft}
        className="w-4 h-4 transition-transform group-hover:-translate-x-1"
      />
      {c("back")}
    </button>
  );
}
