"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { cn, HelpHint, Icon } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";
import { ICON_PATHS } from "@/lib/icons";

type Status = "active" | "paused" | "travel" | "unconfigured";

const STATUS_META: Record<Status, { dot: string; icon: string }> = {
  active: {
    dot: "bg-secondary",
    icon: ICON_PATHS.shieldCheck,
  },
  paused: {
    dot: "bg-on-surface-variant",
    icon: ICON_PATHS.warning,
  },
  travel: {
    dot: "bg-tertiary-fixed",
    icon: ICON_PATHS.shieldCheck,
  },
  unconfigured: {
    dot: "bg-outline-variant",
    icon: ICON_PATHS.warning,
  },
};

/**
 * Sidebar pill that surfaces the Life Check state at all times. Click → routes
 * to `/settings/continuity` where the user can flip the pause / Travel Mode
 * controls.
 */
export function ContinuityStatusBadge() {
  const t = useTranslations("lifeCheck");
  const config = useQuery(api.life_check.getConfig);

  let status: Status = "unconfigured";
  let returnDate: number | null = null;

  if (config !== undefined) {
    if (config === null) {
      status = "unconfigured";
    } else if (config.travelModeEnabled) {
      status = "travel";
      returnDate = config.travelModeUntil ?? null;
    } else if (!config.isActive) {
      status = "paused";
    } else {
      status = "active";
    }
  }

  const meta = STATUS_META[status];
  const helpContent = (
    <span>
      {t("badge.help.intro")}
      <strong className="block mt-1">{t("badge.help.activeLabel")}</strong>{" "}
      {t("badge.help.activeText")}
      <strong className="block mt-1">{t("badge.help.pausedLabel")}</strong>{" "}
      {t("badge.help.pausedText")}
      <strong className="block mt-1">{t("badge.help.travelLabel")}</strong>{" "}
      {t("badge.help.travelText")}
    </span>
  );
  const formattedReturn = returnDate
    ? new Date(returnDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container-highest">
      <Link
        href="/settings/continuity"
        className="flex flex-1 items-center gap-3 min-w-0 cursor-pointer group"
      >
        <span className={cn("w-2 h-2 rounded-full shrink-0", meta.dot)} />
        <Icon path={meta.icon} className="w-4 h-4 text-secondary shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-label-md text-primary truncate group-hover:underline">
            {t(`badge.status.${status}`)}
          </p>
          <p className="text-[10px] text-on-surface-variant truncate">
            {formattedReturn
              ? t("badge.resumes", { date: formattedReturn })
              : "Life Check"}
          </p>
        </div>
      </Link>
      <HelpHint
        content={helpContent}
        side="right"
        label={t("badge.helpLabel")}
      />
    </div>
  );
}
