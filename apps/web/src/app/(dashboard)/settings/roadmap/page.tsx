import { Link } from "@/lib/navigation";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useDictionary, useTranslations } from "@/lib/i18n";

// One icon per upcoming feature, matched positionally to roadmap.upcomingFeatures.items.
const ROADMAP_ICONS = [
  ICON_PATHS.notificationsActive, // Telegram notifications
  ICON_PATHS.sms, // SMS notifications & life check-in
  ICON_PATHS.globe, // Data residency
  ICON_PATHS.download, // Vault export
  ICON_PATHS.lawyer, // Notarial & legal compliance
  ICON_PATHS.link, // Blockchain anchoring
  ICON_PATHS.phone, // Mobile apps
  ICON_PATHS.verifiedUser, // Bank-grade audit
  ICON_PATHS.key, // Hardware key support
  ICON_PATHS.settingsSuggest, // Personalization
  ICON_PATHS.accountTree, // Estate management
  ICON_PATHS.accountBalance, // Succession of estate frameworks
  ICON_PATHS.verifiedFill, // Document certification
];

export default function SettingsRoadmapPage() {
  const t = useTranslations("roadmap");
  const items = useDictionary().roadmap.upcomingFeatures.items;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-1">
        <h2 className="text-headline-sm text-primary">
          {t("upcomingFeatures.heading")}
        </h2>
        <p className="text-body-md text-on-surface-variant">
          {t("upcomingFeatures.description")}
        </p>
      </div>

      <ul className="space-y-3">
        {items.map((item, i) => (
          <li
            key={item.title}
            className="bg-surface-container-lowest ghost-border rounded-2xl p-5 flex gap-4"
          >
            <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/10 text-secondary">
              <Icon
                path={ROADMAP_ICONS[i] ?? ICON_PATHS.settingsSuggest}
                className="w-5 h-5"
              />
            </span>
            <div className="space-y-1 min-w-0">
              <h3 className="text-headline-sm text-primary">{item.title}</h3>
              <p className="text-body-md text-on-surface-variant">
                {item.description}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="bg-primary text-on-primary rounded-2xl p-6 space-y-4">
        <div className="space-y-2">
          <h2 className="text-headline-sm">{t("requestFeature.heading")}</h2>
          <p className="text-body-md text-on-primary-container">
            {t("requestFeature.description")}
          </p>
        </div>
        <Link
          href="/settings/contact?topic=feature_request"
          replace
          className="inline-flex items-center gap-2 bg-secondary-fixed text-on-secondary-fixed font-headline font-extrabold px-6 py-3 rounded-xl hover:opacity-90 transition-all active:scale-95"
        >
          {t("requestFeature.cta")}
          <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
