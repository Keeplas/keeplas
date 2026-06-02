import { Link } from "@/lib/navigation";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

const IOS_STEPS = ["open", "profile", "fill", "showLocked", "shareCall"];
const ANDROID_STEPS = ["open", "medical", "contacts", "lockScreen", "sos"];

export default function EmergencyInfoDocPage() {
  const t = useTranslations("docs");
  return (
    <div className="max-w-screen-md mx-auto space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-label-md text-on-surface-variant">
        <Link href="/docs" className="hover:text-secondary">
          {t("breadcrumb")}
        </Link>
        <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        <span className="text-primary">{t("emergencyInfo.eyebrow")}</span>
      </nav>

      {/* Header */}
      <header className="space-y-4">
        <span className="text-label-md text-secondary">
          {t("emergencyInfo.eyebrow")}
        </span>
        <h1 className="text-headline-lg text-primary">
          {t("emergencyInfo.title")}
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          {t("emergencyInfo.intro")}
        </p>
      </header>

      {/* Why we redirect */}
      <section className="bg-primary text-on-primary rounded-2xl p-8 space-y-3">
        <h2 className="text-headline-sm">{t("emergencyInfo.why.heading")}</h2>
        <p className="text-body-md text-on-primary-container">
          {t("emergencyInfo.why.body")}
        </p>
      </section>

      {/* iPhone */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-secondary rounded-full" />
          <h2 className="text-headline-md text-primary">
            {t("emergencyInfo.ios.heading")}
          </h2>
        </div>
        <ol className="relative pl-8 border-l-2 border-secondary/20 space-y-6">
          {IOS_STEPS.map((key, i) => (
            <Step
              key={key}
              value={`0${i + 1}`}
              title={t(`emergencyInfo.ios.steps.${key}.title`)}
              body={t(`emergencyInfo.ios.steps.${key}.body`)}
            />
          ))}
        </ol>
        <p className="text-body-md text-on-surface-variant">
          {t("emergencyInfo.ios.verify.p1")}
          <span className="font-medium text-primary">
            {t("emergencyInfo.ios.verify.em1")}
          </span>
          {t("emergencyInfo.ios.verify.p2")}
          <span className="font-medium text-primary">
            {t("emergencyInfo.ios.verify.em2")}
          </span>
          {t("emergencyInfo.ios.verify.p3")}
        </p>
      </section>

      {/* Android */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-primary rounded-full" />
          <h2 className="text-headline-md text-primary">
            {t("emergencyInfo.android.heading")}
          </h2>
        </div>
        <p className="text-body-md text-on-surface-variant">
          {t("emergencyInfo.android.intro")}
        </p>
        <ol className="relative pl-8 border-l-2 border-primary/20 space-y-6">
          {ANDROID_STEPS.map((key, i) => (
            <Step
              key={key}
              value={`0${i + 1}`}
              title={t(`emergencyInfo.android.steps.${key}.title`)}
              body={t(`emergencyInfo.android.steps.${key}.body`)}
            />
          ))}
        </ol>
        <p className="text-body-md text-on-surface-variant">
          {t("emergencyInfo.android.verify.p1")}
          <span className="font-medium text-primary">
            {t("emergencyInfo.android.verify.em1")}
          </span>
          {t("emergencyInfo.android.verify.p2")}
          <span className="font-medium text-primary">
            {t("emergencyInfo.android.verify.em2")}
          </span>
          {t("emergencyInfo.android.verify.p3")}
        </p>
      </section>

      {/* What Keeplas does instead */}
      <section className="bg-surface-container-low rounded-2xl p-8 ghost-border space-y-4">
        <h2 className="text-headline-sm text-primary">
          {t("emergencyInfo.covers.heading")}
        </h2>
        <p className="text-body-md text-on-surface-variant">
          {t("emergencyInfo.covers.body")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <Link
            href="/trusted-contacts"
            className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
          >
            <Icon path={ICON_PATHS.users} className="w-5 h-5 text-secondary" />
            <span className="text-body-md font-medium text-primary">
              {t("emergencyInfo.covers.trustedLink")}
            </span>
          </Link>
          <Link
            href="/life-check"
            className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
          >
            <Icon
              path={ICON_PATHS.heartbeat}
              className="w-5 h-5 text-secondary"
            />
            <span className="text-body-md font-medium text-primary">
              {t("emergencyInfo.covers.lifeCheckLink")}
            </span>
          </Link>
        </div>
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
