import { ContinuityControls } from "@/components/continuity-controls";
import { useTranslations } from "@/lib/i18n";

export default function SettingsContinuityPage() {
  const t = useTranslations("settingsSecurity");
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-headline-md text-primary mb-2">
          {t("continuity.title")}
        </h2>
        <p className="text-body-md text-on-surface-variant max-w-2xl">
          {t("continuity.description")}
        </p>
      </header>

      <ContinuityControls />
    </div>
  );
}
