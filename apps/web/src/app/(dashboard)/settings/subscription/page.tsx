"use client";

import { Button, cn, Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

interface PlanFeature {
  label: string;
  included: boolean;
}

interface Plan {
  id: "free" | "lifetime";
  name: string;
  tagline: string;
  priceMonthly?: string;
  priceOneTime?: string;
  priceSuffix: string;
  features: PlanFeature[];
  cta: string;
  popular?: boolean;
  dark?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Essential digital storage.",
    priceMonthly: "$0",
    priceSuffix: "/forever",
    features: [
      { label: "100 MB Zero-Knowledge Vault", included: true },
      { label: "Basic Life Check (Monthly)", included: true },
      { label: "1 Emergency Contact", included: true },
      { label: "Emergency Card (Digital)", included: true },
      { label: "Data Hosting Country Choice (Coming Soon)", included: false },
      { label: "Notarial & Legal Compliance (Coming Soon)", included: false },
    ],
    cta: "Start Free",
  },
  {
    id: "lifetime",
    name: "Lifetime",
    tagline: "Everything you need, forever, in a single payment.",
    priceOneTime: "$199",
    priceSuffix: "one-time",
    features: [
      { label: "10 GB Zero-Knowledge Vault", included: true },
      { label: "More Storage Available as Add-on", included: true },
      { label: "Full Scenario Engine", included: true },
      { label: "5 Emergency Contacts", included: true },
      { label: "Priority Social Recovery", included: true },
      { label: "Emergency Card (Physical)", included: true },
      { label: "Video Legacy Messages", included: true },
      { label: "Weekly Life Check", included: true },
      { label: "Early Adopter Badge", included: true },
      { label: "Priority Support", included: true },
      { label: "Data Hosting Country Choice (Coming Soon)", included: false },
      { label: "Notarial & Legal Compliance (Coming Soon)", included: false },
    ],
    cta: "Get Lifetime Access",
    popular: true,
    dark: true,
  },
];

function PriceDisplay({ plan }: { plan: Plan }) {
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
        {plan.priceSuffix}
      </span>
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <div className="max-w-screen-xl mx-auto space-y-10">
      <header className="space-y-3 text-center md:text-left">
        <h1 className="text-headline-lg text-primary">
          Legacy Architecture. Secured Forever.
        </h1>
        <p className="text-body-lg text-on-surface-variant max-w-2xl">
          Choose the protection level that fits your continuity plan. Both tiers
          run the same zero-knowledge encryption — only the surface area
          changes.
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
                Popular
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
                  {plan.name}
                </h2>
                <p
                  className={cn(
                    "text-body-md mt-1",
                    plan.dark ? "text-white/70" : "text-on-surface-variant",
                  )}
                >
                  {plan.tagline}
                </p>
              </div>

              <PriceDisplay plan={plan} />

              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature.label} className="flex items-start gap-3">
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
                      {feature.label}
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
                {plan.cta}
              </Button>
            </div>
          </article>
        ))}
      </section>

      <footer className="text-center text-body-md text-on-surface-variant pt-6">
        Pricing displayed in USD. Switching plans never deletes your vault.
      </footer>
    </div>
  );
}
