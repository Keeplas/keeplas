"use client";

import Link from "next/link";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

interface Feature {
  key: string;
  iconPath: string;
  href: string;
  accent: string;
}

const CORE_FEATURES: Feature[] = [
  {
    key: "vault",
    iconPath: ICON_PATHS.lock,
    href: "/docs/vault",
    accent: "bg-secondary/10 text-secondary",
  },
  {
    key: "lifeCheck",
    iconPath: ICON_PATHS.heartbeat,
    href: "/docs/life-check",
    accent: "bg-error/10 text-error",
  },
  {
    key: "letters",
    iconPath: ICON_PATHS.notes,
    href: "/docs/letters",
    accent: "bg-tertiary/15 text-tertiary",
  },
  {
    key: "emergency",
    iconPath: ICON_PATHS.medicalInformation,
    href: "/docs/emergency-info",
    accent: "bg-secondary/10 text-secondary",
  },
  {
    key: "trustedContacts",
    iconPath: ICON_PATHS.users,
    href: "/docs/trusted-contacts",
    accent: "bg-primary/10 text-primary",
  },
  {
    key: "recovery",
    iconPath: ICON_PATHS.key,
    href: "/docs/recovery",
    accent: "bg-tertiary/15 text-tertiary",
  },
  {
    key: "insights",
    iconPath: ICON_PATHS.psychology,
    href: "/docs/insights",
    accent: "bg-secondary/10 text-secondary",
  },
];

const SECURITY_POINTS: Array<{ key: string; iconPath: string }> = [
  { key: "zeroKnowledge", iconPath: ICON_PATHS.shieldCheck },
  { key: "shamir", iconPath: ICON_PATHS.hub },
  { key: "auditLog", iconPath: ICON_PATHS.key },
  { key: "recoveryKit", iconPath: ICON_PATHS.print },
];

const QUICK_LINKS: Array<{ key: string; href: string; iconPath: string }> = [
  { key: "hub", href: "/hub", iconPath: ICON_PATHS.hub },
  {
    key: "security",
    href: "/settings/security",
    iconPath: ICON_PATHS.key,
  },
  {
    key: "recoveryKit",
    href: "/settings/recovery-kit",
    iconPath: ICON_PATHS.key,
  },
  {
    key: "subscription",
    href: "/settings/subscription",
    iconPath: ICON_PATHS.creditCard,
  },
];

const LIFECYCLE_STEPS = [
  { key: "cadence", accent: "bg-secondary" },
  { key: "window", accent: "bg-secondary/60" },
  { key: "confirmation", accent: "bg-tertiary" },
  { key: "grace", accent: "bg-warning" },
  { key: "release", accent: "bg-error" },
];

export default function DocsPage() {
  const t = useTranslations("docs");
  return (
    <div className="max-w-screen-2xl mx-auto space-y-16">
      {/* Header */}
      <header className="space-y-4">
        <span className="text-label-md text-secondary">{t("hub.eyebrow")}</span>
        <h1 className="text-headline-lg text-primary">{t("hub.title")}</h1>
        <p className="text-body-lg text-on-surface-variant max-w-2xl">
          {t("hub.intro")}
        </p>
      </header>

      {/* Hero zero-knowledge explainer */}
      <section className="bg-primary text-on-primary rounded-[2rem] p-10 md:p-12 relative overflow-hidden">
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-secondary/10 blur-[100px] pointer-events-none" />
        <div className="relative z-10 space-y-5 max-w-2xl">
          <span className="inline-flex items-center px-3 py-1 bg-white/10 backdrop-blur rounded-full text-label-md border border-white/20">
            {t("hub.hero.badge")}
          </span>
          <h2 className="text-headline-lg">{t("hub.hero.title")}</h2>
          <p className="text-body-lg text-on-primary-container">
            {t("hub.hero.body")}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/settings/recovery-kit"
              className="inline-flex items-center gap-2 bg-secondary-fixed text-on-secondary-fixed font-headline font-extrabold px-6 py-3 rounded-xl hover:opacity-90 transition-all active:scale-95"
            >
              {t("hub.hero.exportKit")}
            </Link>
            <Link
              href="/settings/security"
              className="inline-flex items-center gap-2 border border-white/20 text-white px-6 py-3 rounded-xl hover:bg-white/10 transition-all font-headline font-bold"
            >
              {t("hub.hero.securityCenter")}
            </Link>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-secondary rounded-full" />
          <h2 className="text-headline-md text-primary">
            {t("hub.coreFeatures.heading")}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CORE_FEATURES.map((feature) => (
            <Link
              key={feature.key}
              href={feature.href}
              className="bg-surface-container-low rounded-2xl p-6 ghost-border hover:bg-surface-container transition-colors group flex flex-col gap-4"
            >
              <span
                className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${feature.accent}`}
              >
                <Icon path={feature.iconPath} className="w-5 h-5" />
              </span>
              <div className="space-y-2">
                <h3 className="text-headline-sm text-primary">
                  {t(`hub.features.${feature.key}.title`)}
                </h3>
                <p className="text-body-md text-on-surface-variant">
                  {t(`hub.features.${feature.key}.description`)}
                </p>
              </div>
              <span className="mt-auto pt-2 flex items-center gap-2 text-label-md text-secondary">
                {t("hub.coreFeatures.read")}
                <Icon
                  path={ICON_PATHS.chevronRight}
                  className="w-3 h-3 group-hover:translate-x-1 transition-transform"
                />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Security model */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-primary rounded-full" />
          <h2 className="text-headline-md text-primary">
            {t("hub.securityModel.heading")}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SECURITY_POINTS.map((point) => (
            <article
              key={point.key}
              className="bg-surface-container-lowest rounded-2xl p-6 ghost-border flex gap-4"
            >
              <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/10 text-secondary">
                <Icon path={point.iconPath} className="w-5 h-5" />
              </span>
              <div className="space-y-1">
                <h3 className="text-headline-sm text-primary">
                  {t(`hub.security.${point.key}.title`)}
                </h3>
                <p className="text-body-md text-on-surface-variant">
                  {t(`hub.security.${point.key}.body`)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Lifecycle flow */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-error rounded-full" />
          <h2 className="text-headline-md text-primary">
            {t("hub.lifecycle.heading")}
          </h2>
        </div>
        <ol className="relative pl-8 border-l-2 border-secondary/20 space-y-8">
          {LIFECYCLE_STEPS.map((step) => (
            <LifecycleStep
              key={step.key}
              value={t(`hub.lifecycle.steps.${step.key}.value`)}
              title={t(`hub.lifecycle.steps.${step.key}.title`)}
              body={t(`hub.lifecycle.steps.${step.key}.body`)}
              accent={step.accent}
            />
          ))}
        </ol>
        <div className="pt-4">
          <Link
            href="/docs/recovery"
            className="inline-flex items-center gap-2 text-secondary font-bold text-body-md hover:underline"
          >
            {t("hub.lifecycle.readMore")}
            <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
          </Link>
        </div>
      </section>

      {/* Quick links */}
      <section className="bg-surface-container-low rounded-2xl p-8 ghost-border">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
          <div>
            <h2 className="text-headline-sm text-primary">
              {t("hub.quickLinks.heading")}
            </h2>
            <p className="text-body-md text-on-surface-variant mt-1">
              {t("hub.quickLinks.subtitle")}
            </p>
          </div>
        </div>
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {QUICK_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container transition-colors text-body-md font-medium text-primary"
              >
                <Icon
                  path={link.iconPath}
                  className="w-4 h-4 text-secondary shrink-0"
                />
                <span className="truncate">
                  {t(`hub.quickLinks.items.${link.key}`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="pt-8 pb-12 text-center text-body-md text-on-surface-variant">
        {t("hub.footer")}
      </footer>
    </div>
  );
}

function LifecycleStep({
  value,
  title,
  body,
  accent,
}: {
  value: string;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <li className="relative">
      <span
        className={`absolute -left-[41px] top-1 w-4 h-4 rounded-full border-4 border-surface ${accent}`}
      />
      <p className="text-label-md text-on-surface-variant">{value}</p>
      <h3 className="text-headline-sm text-primary mt-1">{title}</h3>
      <p className="text-body-md text-on-surface-variant mt-1 max-w-xl">
        {body}
      </p>
    </li>
  );
}
