import { Link } from "@/lib/navigation";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

const ENCRYPTION_POINTS = [
  { key: "onDevice", iconPath: ICON_PATHS.encrypted },
  { key: "yourKey", iconPath: ICON_PATHS.key },
  { key: "blind", iconPath: ICON_PATHS.shieldCheck },
];

const STORE_ITEMS = [
  { key: "documents", iconPath: ICON_PATHS.description },
  { key: "credentials", iconPath: ICON_PATHS.lock },
  { key: "financial", iconPath: ICON_PATHS.accountBalance },
  { key: "letters", iconPath: ICON_PATHS.notes },
];

export default function VaultDocPage() {
  const t = useTranslations("docs");
  return (
    <div className="max-w-screen-md mx-auto space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-label-md text-on-surface-variant">
        <Link href="/docs" className="hover:text-secondary">
          {t("breadcrumb")}
        </Link>
        <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        <span className="text-primary">{t("vault.title")}</span>
      </nav>

      {/* Header */}
      <header className="space-y-4">
        <span className="text-label-md text-secondary">
          {t("vault.eyebrow")}
        </span>
        <h1 className="text-headline-lg text-primary">{t("vault.title")}</h1>
        <p className="text-body-lg text-on-surface-variant">
          {t("vault.intro")}
        </p>
      </header>

      {/* How encryption works */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-primary rounded-full" />
          <h2 className="text-headline-md text-primary">
            {t("vault.encryption.heading")}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ENCRYPTION_POINTS.map((point) => (
            <article
              key={point.key}
              className="bg-surface-container-low rounded-2xl p-6 space-y-3 ghost-border"
            >
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/10 text-secondary">
                <Icon path={point.iconPath} className="w-5 h-5" />
              </span>
              <h3 className="text-headline-sm text-primary">
                {t(`vault.encryption.${point.key}.title`)}
              </h3>
              <p className="text-body-md text-on-surface-variant">
                {t(`vault.encryption.${point.key}.body`)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* What you can store */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-secondary rounded-full" />
          <h2 className="text-headline-md text-primary">
            {t("vault.store.heading")}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STORE_ITEMS.map((item) => (
            <StoreItem
              key={item.key}
              iconPath={item.iconPath}
              title={t(`vault.store.${item.key}.title`)}
              body={t(`vault.store.${item.key}.body`)}
            />
          ))}
        </div>
      </section>

      {/* Storage quotas */}
      <section className="bg-surface-container-low rounded-2xl p-8 ghost-border space-y-4">
        <h2 className="text-headline-sm text-primary">
          {t("vault.storage.heading")}
        </h2>
        <p className="text-body-md text-on-surface-variant">
          {t("vault.storage.body")}
        </p>
        <Link
          href="/settings/subscription"
          className="inline-flex items-center gap-2 text-secondary font-bold text-body-md hover:underline"
        >
          {t("vault.storage.comparePlans")}
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
            {t("vault.openVault")}
          </span>
        </Link>
        <Link
          href="/docs/letters"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon path={ICON_PATHS.notes} className="w-5 h-5 text-secondary" />
          <span className="text-body-md font-medium text-primary">
            {t("vault.lettersLink")}
          </span>
        </Link>
      </section>
    </div>
  );
}

function StoreItem({
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
      <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/10 text-secondary">
        <Icon path={iconPath} className="w-5 h-5" />
      </span>
      <div className="space-y-1">
        <h3 className="text-headline-sm text-primary">{title}</h3>
        <p className="text-body-md text-on-surface-variant">{body}</p>
      </div>
    </article>
  );
}
