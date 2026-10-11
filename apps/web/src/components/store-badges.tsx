import { STORE_URLS } from "@/lib/app-stores";
import { useTranslations } from "@/lib/i18n";

const BADGE_CLASS =
  "flex flex-col rounded-sm bg-action-primary px-[16px] py-[8px] text-left text-text-inverse transition-colors hover:bg-action-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus";

/**
 * App Store / Google Play badges (D-01). A store whose URL is not configured
 * falls back to `/download`, which picks the store by user agent or shows D-01.
 */
export function StoreBadges() {
  const t = useTranslations("getApp.stores");
  const badges = [
    {
      href: STORE_URLS.appStore,
      caption: t("appStoreCaption"),
      name: "App Store",
    },
    {
      href: STORE_URLS.playStore,
      caption: t("playCaption"),
      name: "Google Play",
    },
  ];
  return (
    <div className="flex justify-center gap-[12px]">
      {badges.map((badge) => (
        <a
          key={badge.name}
          href={badge.href ?? "/download"}
          className={BADGE_CLASS}
        >
          <span className="text-caption">{badge.caption}</span>
          <span className="text-label">{badge.name}</span>
        </a>
      ))}
    </div>
  );
}
