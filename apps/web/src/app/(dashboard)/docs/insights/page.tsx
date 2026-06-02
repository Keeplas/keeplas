import { Link } from "@/lib/navigation";
import { Icon, InfoCallout } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { LEGACY_TIPS, type LegacyTip } from "@/lib/legacy-tips";
import { useTranslations } from "@/lib/i18n";

const DIED_TODAY_ITEMS = ["identity", "money", "cloud", "people", "wishes"];
const CARD_ITEMS = ["identity", "medical", "contacts", "directives"];

export default function InsightsDocPage() {
  const t = useTranslations("docs");
  return (
    <div className="max-w-screen-md mx-auto space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-label-md text-on-surface-variant">
        <Link href="/docs" className="hover:text-secondary">
          {t("breadcrumb")}
        </Link>
        <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        <span className="text-primary">{t("insights.eyebrow")}</span>
      </nav>

      {/* Header */}
      <header className="space-y-4">
        <span className="text-label-md text-secondary">
          {t("insights.eyebrow")}
        </span>
        <h1 className="text-headline-lg text-primary">{t("insights.title")}</h1>
        <p className="text-body-lg text-on-surface-variant">
          {t("insights.intro")}
        </p>
      </header>

      {/* Table of contents */}
      <nav className="bg-surface-container-low rounded-2xl p-6">
        <h2 className="text-label-md text-on-surface-variant mb-4">
          {t("insights.toc")}
        </h2>
        <ol className="space-y-2 list-decimal list-inside">
          {LEGACY_TIPS.map((tip) => (
            <li key={tip.slug} className="text-body-md">
              <a
                href={`#${tip.slug}`}
                className="text-primary hover:text-secondary"
              >
                {t(`insights.tips.${tip.slug}.title`)}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* 1 — If you died today */}
      <Section slug="if-you-died-today" tone="warning" iconKey="helpCircle">
        <p>{t("insights.diedToday.p1")}</p>
        <p>{t("insights.diedToday.p2")}</p>
        <ul className="list-disc list-inside space-y-1 text-body-md text-on-surface-variant">
          {DIED_TODAY_ITEMS.map((k) => (
            <li key={k}>{t(`insights.diedToday.items.${k}`)}</li>
          ))}
        </ul>
        <p>{t("insights.diedToday.p3")}</p>
      </Section>

      {/* 2 — Don't let your secrets die with you */}
      <Section slug="secrets-die-with-you" tone="warning" iconKey="cloudOff">
        <p>{t("insights.secrets.p1")}</p>
        <p>{t("insights.secrets.p2")}</p>
        <p>{t("insights.secrets.p3")}</p>
        <Link
          href="/vault"
          className="inline-flex items-center gap-2 text-body-md text-secondary hover:underline"
        >
          {t("insights.secrets.link")}
          <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4" />
        </Link>
      </Section>

      {/* 3 — Probate moves in months */}
      <Section slug="probate-vs-grief" tone="warning" iconKey="lockClock">
        <p>{t("insights.probate.p1")}</p>
        <p>{t("insights.probate.p2")}</p>
        <p>{t("insights.probate.p3")}</p>
        <Link
          href="/docs/recovery"
          className="inline-flex items-center gap-2 text-body-md text-secondary hover:underline"
        >
          {t("insights.probate.link")}
          <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4" />
        </Link>
      </Section>

      {/* 4 — Medical ID */}
      <Section slug="medical-id" tone="success" iconKey="medicalInformation">
        <p>{t("insights.medicalId.p1")}</p>
        <InfoCallout icon={ICON_PATHS.info} tone="info">
          {t("insights.medicalId.callout")}
        </InfoCallout>
        <Link
          href="/docs/emergency-info"
          className="inline-flex items-center gap-2 text-body-md text-secondary hover:underline"
        >
          {t("insights.medicalId.link")}
          <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4" />
        </Link>
      </Section>

      {/* 5 — Emergency Card */}
      <Section slug="emergency-card" tone="success" iconKey="contactPage">
        <p>{t("insights.card.p1")}</p>
        <p>{t("insights.card.p2")}</p>
        <ul className="list-disc list-inside space-y-1 text-body-md text-on-surface-variant">
          {CARD_ITEMS.map((k) => (
            <li key={k}>{t(`insights.card.items.${k}`)}</li>
          ))}
        </ul>
        <p>{t("insights.card.p3")}</p>
        <Link
          href="/trusted-contacts"
          className="inline-flex items-center gap-2 text-body-md text-secondary hover:underline"
        >
          {t("insights.card.link")}
          <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4" />
        </Link>
      </Section>

      {/* 6 — 24 words */}
      <Section slug="twenty-four-words" tone="info" iconKey="key">
        <p>{t("insights.words.p1")}</p>
        <p>{t("insights.words.p2")}</p>
        <p>{t("insights.words.p3")}</p>
        <Link
          href="/settings/recovery-kit"
          className="inline-flex items-center gap-2 text-body-md text-secondary hover:underline"
        >
          {t("insights.words.link")}
          <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4" />
        </Link>
      </Section>

      {/* 7 — Zero-knowledge */}
      <Section slug="zero-knowledge" tone="info" iconKey="shieldCheck">
        <p>{t("insights.zeroKnowledge.p1")}</p>
        <p>{t("insights.zeroKnowledge.p2")}</p>
        <p>{t("insights.zeroKnowledge.p3")}</p>
      </Section>

      {/* 8 — Trusted Contacts */}
      <Section slug="trusted-contacts" tone="info" iconKey="group">
        <p>{t("insights.trustedContacts.p1")}</p>
        <p>{t("insights.trustedContacts.p2")}</p>
        <Link
          href="/docs/trusted-contacts"
          className="inline-flex items-center gap-2 text-body-md text-secondary hover:underline"
        >
          {t("insights.trustedContacts.link")}
          <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4" />
        </Link>
      </Section>

      {/* 9 — Quantum-safe */}
      <Section slug="quantum-safe" tone="info" iconKey="fingerprint">
        <p>{t("insights.quantumSafe.p1")}</p>
        <p>{t("insights.quantumSafe.p2")}</p>
        <p>{t("insights.quantumSafe.p3")}</p>
      </Section>

      {/* Footer back-link */}
      <section className="bg-surface-container-low rounded-2xl p-8 ghost-border space-y-3">
        <h2 className="text-headline-sm text-primary">
          {t("insights.footer.heading")}
        </h2>
        <p className="text-body-md text-on-surface-variant">
          {t("insights.footer.body")}
        </p>
        <Link
          href="/hub"
          className="inline-flex items-center gap-2 text-body-md text-secondary hover:underline"
        >
          {t("insights.footer.link")}
          <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4" />
        </Link>
      </section>
    </div>
  );
}

function Section({
  slug,
  tone,
  iconKey,
  children,
}: {
  slug: LegacyTip["slug"];
  tone: LegacyTip["tone"];
  iconKey: LegacyTip["iconKey"];
  children: React.ReactNode;
}) {
  const t = useTranslations("docs");
  const tip = LEGACY_TIPS.find((entry) => entry.slug === slug);
  if (!tip) return null;
  return (
    <section
      id={slug}
      className="scroll-mt-24 space-y-5 border-t border-outline-variant/30 pt-12"
    >
      <div className="flex items-center gap-3">
        <span className="w-2 h-8 bg-secondary rounded-full" />
        <span className="text-label-md text-secondary uppercase tracking-wide">
          {t(`insights.toneLabels.${tone}`)}
        </span>
      </div>
      <div className="flex items-start gap-4">
        <Icon
          path={ICON_PATHS[iconKey]}
          className="w-7 h-7 text-secondary shrink-0 mt-1"
        />
        <h2 className="text-headline-md text-primary">
          {t(`insights.tips.${slug}.title`)}
        </h2>
      </div>
      <div className="space-y-4 text-body-md text-on-surface-variant leading-relaxed">
        {children}
      </div>
    </section>
  );
}
