"use client";

import { Button, cn, Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

interface PlanFeature {
  /** i18n key suffix under settings.subscription.features. */
  key: string;
  included: boolean;
}

interface Plan {
  id: "free" | "lifetime";
  priceMonthly?: string;
  priceOneTime?: string;
  /** i18n key suffix under settings.subscription.priceSuffix. */
  priceSuffixKey: string;
  features: PlanFeature[];
  popular?: boolean;
  dark?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "free",
    priceMonthly: "$0",
    priceSuffixKey: "forever",
    features: [
      { key: "freeVault", included: true },
      { key: "basicLifeCheck", included: true },
      { key: "oneEmergencyContact", included: true },
      { key: "emergencyCardDigital", included: true },
      { key: "dataHostingCountry", included: false },
      { key: "notarialCompliance", included: false },
    ],
  },
  {
    id: "lifetime",
    priceOneTime: "$199",
    priceSuffixKey: "oneTime",
    features: [
      { key: "lifetimeVault", included: true },
      { key: "moreStorageAddon", included: true },
      { key: "fullScenarioEngine", included: true },
      { key: "fiveEmergencyContacts", included: true },
      { key: "prioritySocialRecovery", included: true },
      { key: "emergencyCardPhysical", included: true },
      { key: "videoLegacyMessages", included: true },
      { key: "weeklyLifeCheck", included: true },
      { key: "earlyAdopterBadge", included: true },
      { key: "prioritySupport", included: true },
      { key: "dataHostingCountry", included: false },
      { key: "notarialCompliance", included: false },
    ],
    popular: true,
    dark: true,
  },
];

function PriceDisplay({ plan }: { plan: Plan }) {
  const t = useTranslations("settings");
  const display =
    plan.id === "lifetime" ? plan.priceOneTime : plan.priceMonthly;

  return (
    <div className="flex items-baseline gap-2">
      <span
        className={cn(
          "text-[2.5rem] font-bold tracking-tight leading-none",
          plan.dark ? "text-white" : "text-on-surface",
        )}
      >
        {display}
      </span>
      <span
        className={cn(
          "text-body-md",
          plan.dark ? "text-white/70" : "text-on-surface-variant",
        )}
      >
        {t(`subscription.priceSuffix.${plan.priceSuffixKey}`)}
      </span>
    </div>
  );
}

export default function SubscriptionPage() {
  const t = useTranslations("settings");
  return (
    <div className="max-w-screen-xl mx-auto space-y-10">
      <header className="space-y-3 text-center md:text-left">
        <h1 className="text-headline-lg text-primary">
          {t("subscription.title")}
        </h1>
        <p className="text-body-lg text-on-surface-variant max-w-2xl">
          {t("subscription.description")}
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PLANS.map((plan) => (
          <article
            key={plan.id}
            className={cn(
              "relative rounded-3xl p-8 flex flex-col justify-between",
              plan.dark
                ? "bg-primary text-white shadow-2xl shadow-primary/30"
                : "bg-surface-container-low",
            )}
          >
            {plan.popular && (
              <span className="absolute top-6 right-6 text-label-md bg-secondary text-on-secondary px-3 py-1 rounded-full">
                {t("subscription.popular")}
              </span>
            )}

            <div className="space-y-6">
              <div>
                <h2
                  className={cn(
                    "text-headline-md",
                    plan.dark ? "text-white" : "text-primary",
                  )}
                >
                  {t(`subscription.plans.${plan.id}.name`)}
                </h2>
                <p
                  className={cn(
                    "text-body-md mt-1",
                    plan.dark ? "text-white/70" : "text-on-surface-variant",
                  )}
                >
                  {t(`subscription.plans.${plan.id}.tagline`)}
                </p>
              </div>

              <PriceDisplay plan={plan} />

              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature.key} className="flex items-start gap-3">
                    <span
                      className={cn(
                        "shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5",
                        feature.included
                          ? plan.dark
                            ? "bg-white/15 text-secondary-fixed"
                            : "bg-secondary/15 text-secondary"
                          : plan.dark
                            ? "bg-white/5 text-white/30"
                            : "bg-surface-container-high text-outline-variant",
                      )}
                    >
                      {feature.included ? (
                        <Icon
                          path={ICON_PATHS.checkCircle}
                          className="w-3.5 h-3.5"
                        />
                      ) : (
                        <span className="block w-2 h-0.5 bg-current rounded-full" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-body-md",
                        feature.included
                          ? plan.dark
                            ? "text-white"
                            : "text-on-surface"
                          : plan.dark
                            ? "text-white/40"
                            : "text-on-surface-variant/60",
                      )}
                    >
                      {t(`subscription.features.${feature.key}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-8">
              <Button
                variant={plan.dark ? "secondary" : "outline"}
                size="lg"
                className={cn(
                  "w-full",
                  plan.dark
                    ? "bg-secondary-fixed text-on-secondary-fixed hover:bg-secondary-fixed/90"
                    : "",
                )}
              >
                {t(`subscription.plans.${plan.id}.cta`)}
              </Button>
            </div>
          </article>
        ))}
      </section>

      <footer className="text-center text-body-md text-on-surface-variant pt-6">
        {t("subscription.footer")}
      </footer>
    </div>
  );
}
