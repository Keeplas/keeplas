import { cn, Icon } from "@keeplas/ui";
import { IconTile, Panel, StatusChip } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

const PLANS = [
  {
    id: "free",
    icon: ICON_PATHS.lock,
    perks: ["storage", "contacts", "lifeCheck"],
  },
  {
    id: "lifetime",
    icon: ICON_PATHS.flash,
    perks: ["storage", "features", "noSubscription", "newPhone"],
  },
] as const;

/**
 * Plans and what Lifetime adds. Lifetime is sold only in the mobile app
 * (App Store / Google Play through RevenueCat); its webhook flips the plan,
 * and the reactive viewer query updates this page on its own.
 */
export function SubscriptionView({
  currentPlan,
}: {
  /** Undefined while the viewer loads. */
  currentPlan: "free" | "lifetime" | undefined;
}) {
  const t = useTranslations("settings.subscription");

  return (
    <div className="flex flex-col gap-[24px]">
      <header className="flex flex-col gap-[8px]">
        <h1 className="text-h1 text-text-primary">{t("title")}</h1>
        <p className="max-w-[640px] text-body-lg text-text-muted">
          {t("description")}
        </p>
      </header>

      <div className="grid items-start gap-[20px] lg:grid-cols-2">
        {PLANS.map((plan) => (
          <Panel
            key={plan.id}
            className={cn(
              "flex flex-col gap-[20px] p-[24px]",
              plan.id === "lifetime" && "border-border-strong",
            )}
          >
            <div className="flex items-center gap-[14px]">
              <IconTile
                icon={plan.icon}
                className="bg-bg-info text-text-link"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <h2 className="text-h3 text-text-primary">
                  {t(`plans.${plan.id}.name`)}
                </h2>
                <p className="text-body-sm text-text-muted">
                  {t(`plans.${plan.id}.priceNote`)}
                </p>
              </div>
              <p className="text-h2 text-text-primary">
                {t(`plans.${plan.id}.price`)}
              </p>
            </div>

            <ul className="flex flex-col gap-[12px]">
              {plan.perks.map((perk) => (
                <li key={perk} className="flex items-start gap-[12px]">
                  <Icon
                    path={ICON_PATHS.check}
                    className="mt-[2px] size-[18px] shrink-0 text-status-active"
                  />
                  <span className="text-body text-text-body">
                    {t(`plans.${plan.id}.perks.${perk}`)}
                  </span>
                </li>
              ))}
            </ul>

            {currentPlan === plan.id ? (
              <div>
                <StatusChip
                  tone="neutral"
                  label={t("currentPlan")}
                  dotClassName="bg-status-active"
                />
              </div>
            ) : plan.id === "lifetime" && currentPlan === "free" ? (
              <div className="flex flex-col gap-[8px] rounded-sm bg-bg-info p-[16px]">
                <p className="text-label text-text-primary">{t("inApp")}</p>
                <p className="text-body-sm text-text-muted">{t("paidWith")}</p>
              </div>
            ) : null}
          </Panel>
        ))}
      </div>

      <p className="text-body-sm text-text-muted">{t("footer")}</p>
    </div>
  );
}
