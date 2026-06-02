import { Link } from "@/lib/navigation";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

const TRUST_BULLETS = ["min", "max", "shard", "moments"];
const RECIPIENT_BULLETS = ["noCap", "noResponsibility", "afterUnlock"];
const STEPS = ["accept", "receive", "confirm", "submit"];

export default function TrustedContactsDocPage() {
  const t = useTranslations("docs");
  return (
    <div className="max-w-screen-md mx-auto space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-label-md text-on-surface-variant">
        <Link href="/docs" className="hover:text-secondary">
          {t("breadcrumb")}
        </Link>
        <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        <span className="text-primary">{t("trustedContacts.title")}</span>
      </nav>

      {/* Header */}
      <header className="space-y-4">
        <span className="text-label-md text-secondary">
          {t("trustedContacts.eyebrow")}
        </span>
        <h1 className="text-headline-lg text-primary">
          {t("trustedContacts.title")}
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          {t("trustedContacts.intro")}
        </p>
      </header>

      {/* Two roles */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-primary rounded-full" />
          <h2 className="text-headline-md text-primary">
            {t("trustedContacts.roles.heading")}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <article className="bg-primary text-on-primary rounded-2xl p-6 space-y-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10">
              <Icon path={ICON_PATHS.shieldCheck} className="w-5 h-5" />
            </span>
            <h3 className="text-headline-sm">
              {t("trustedContacts.roles.trust.title")}
            </h3>
            <p className="text-body-md text-on-primary-container">
              {t("trustedContacts.roles.trust.body")}
            </p>
            <ul className="text-body-md text-on-primary-container space-y-1 pt-2">
              {TRUST_BULLETS.map((b) => (
                <li key={b}>
                  · {t(`trustedContacts.roles.trust.bullets.${b}`)}
                </li>
              ))}
            </ul>
          </article>

          <article className="bg-surface-container-low rounded-2xl p-6 space-y-3 ghost-border">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/10 text-secondary">
              <Icon path={ICON_PATHS.users} className="w-5 h-5" />
            </span>
            <h3 className="text-headline-sm text-primary">
              {t("trustedContacts.roles.recipient.title")}
            </h3>
            <p className="text-body-md text-on-surface-variant">
              {t("trustedContacts.roles.recipient.body")}
            </p>
            <ul className="text-body-md text-on-surface-variant space-y-1 pt-2">
              {RECIPIENT_BULLETS.map((b) => (
                <li key={b}>
                  · {t(`trustedContacts.roles.recipient.bullets.${b}`)}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      {/* What a trust contact does */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-secondary rounded-full" />
          <h2 className="text-headline-md text-primary">
            {t("trustedContacts.steps.heading")}
          </h2>
        </div>

        <ol className="relative pl-8 border-l-2 border-secondary/20 space-y-8">
          {STEPS.map((key, i) => (
            <Step
              key={key}
              value={`0${i + 1}`}
              title={t(`trustedContacts.steps.${key}.title`)}
              body={t(`trustedContacts.steps.${key}.body`)}
            />
          ))}
        </ol>
      </section>

      {/* Threshold link */}
      <section className="bg-surface-container-low rounded-2xl p-8 ghost-border space-y-4">
        <h2 className="text-headline-sm text-primary">
          {t("trustedContacts.threshold.heading")}
        </h2>
        <p className="text-body-md text-on-surface-variant">
          {t("trustedContacts.threshold.body")}
        </p>
        <Link
          href="/docs/recovery"
          className="inline-flex items-center gap-2 text-secondary font-bold text-body-md hover:underline"
        >
          {t("trustedContacts.threshold.link")}
          <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        </Link>
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          href="/trusted-contacts"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon path={ICON_PATHS.users} className="w-5 h-5 text-secondary" />
          <span className="text-body-md font-medium text-primary">
            {t("trustedContacts.manageLink")}
          </span>
        </Link>
        <Link
          href="/docs/recovery"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon path={ICON_PATHS.key} className="w-5 h-5 text-secondary" />
          <span className="text-body-md font-medium text-primary">
            {t("trustedContacts.recoveryLink")}
          </span>
        </Link>
      </section>
    </div>
  );
}

function Step({
  value,
  title,
  body,
}: {
  value: string;
  title: string;
  body: string;
}) {
  return (
    <li className="relative">
      <span className="absolute -left-[41px] top-1 w-4 h-4 rounded-full border-4 border-surface bg-secondary" />
      <p className="text-label-md text-on-surface-variant">{value}</p>
      <h3 className="text-headline-sm text-primary mt-1">{title}</h3>
      <p className="text-body-md text-on-surface-variant mt-1">{body}</p>
    </li>
  );
}
