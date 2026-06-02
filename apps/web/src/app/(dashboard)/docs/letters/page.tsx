import { Link } from "@/lib/navigation";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

const DETAILS = [
  { key: "compose", iconPath: ICON_PATHS.editNote },
  { key: "recipients", iconPath: ICON_PATHS.person },
  { key: "trigger", iconPath: ICON_PATHS.timer },
  { key: "validated", iconPath: ICON_PATHS.verifiedFill },
];

export default function LettersDocPage() {
  const t = useTranslations("docs");
  return (
    <div className="max-w-screen-md mx-auto space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-label-md text-on-surface-variant">
        <Link href="/docs" className="hover:text-secondary">
          {t("breadcrumb")}
        </Link>
        <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        <span className="text-primary">{t("letters.title")}</span>
      </nav>

      {/* Header */}
      <header className="space-y-4">
        <span className="text-label-md text-secondary">
          {t("letters.eyebrow")}
        </span>
        <h1 className="text-headline-lg text-primary">{t("letters.title")}</h1>
        <p className="text-body-lg text-on-surface-variant">
          {t("letters.intro")}
        </p>
      </header>

      {/* How it works */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-tertiary rounded-full" />
          <h2 className="text-headline-md text-primary">
            {t("letters.howItWorks")}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DETAILS.map((detail) => (
            <Detail
              key={detail.key}
              iconPath={detail.iconPath}
              title={t(`letters.details.${detail.key}.title`)}
              body={t(`letters.details.${detail.key}.body`)}
            />
          ))}
        </div>
      </section>

      {/* Privacy note */}
      <section className="bg-surface-container-low rounded-2xl p-8 ghost-border space-y-4">
        <h2 className="text-headline-sm text-primary">
          {t("letters.privacy.heading")}
        </h2>
        <p className="text-body-md text-on-surface-variant">
          {t("letters.privacy.body")}
        </p>
        <Link
          href="/docs/trusted-contacts"
          className="inline-flex items-center gap-2 text-secondary font-bold text-body-md hover:underline"
        >
          {t("letters.privacy.link")}
          <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        </Link>
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          href="/vault"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon path={ICON_PATHS.lock} className="w-5 h-5 text-secondary" />
          <span className="text-body-md font-medium text-primary">
            {t("letters.openVault")}
          </span>
        </Link>
        <Link
          href="/docs/vault"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon
            path={ICON_PATHS.encrypted}
            className="w-5 h-5 text-secondary"
          />
          <span className="text-body-md font-medium text-primary">
            {t("letters.vaultLink")}
          </span>
        </Link>
      </section>
    </div>
  );
}

function Detail({
  iconPath,
  title,
  body,
}: {
  iconPath: string;
  title: string;
  body: string;
}) {
  return (
    <article className="bg-surface-container-lowest rounded-2xl p-6 ghost-border flex gap-4">
      <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-tertiary/15 text-tertiary">
        <Icon path={iconPath} className="w-5 h-5" />
      </span>
      <div className="space-y-1">
        <h3 className="text-headline-sm text-primary">{title}</h3>
        <p className="text-body-md text-on-surface-variant">{body}</p>
      </div>
    </article>
  );
}
