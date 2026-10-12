import { Button, Loader, Switch, type CountryCode } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";
import { LifeCheckHistory } from "./life-check-history";
import { ActiveCycleBanner } from "./sections/active-cycle-banner";
import { ChannelList } from "./sections/channel-list";
import { EscalationTimeline } from "./sections/escalation-timeline";
import { FrequencySelector } from "./sections/frequency-selector";
import { Countdown } from "./sections/countdown";
import { ReleaseIntroductionEditor } from "./sections/release-introduction-editor";
import { ReleaseOverview } from "./sections/release-overview";
import { ReleasePolicySettings } from "./sections/release-policy-settings";
import { TravelModeOnMessage } from "./sections/travel-mode-on";
import { TravelModeSection } from "./sections/travel-mode-section";
import { useLifeCheckConfig } from "./sections/use-life-check-config";

export default function LifeCheckPage() {
  const t = useTranslations("lifeCheck");
  const {
    config,
    activeCycle,
    frequency,
    channels,
    phoneNumber,
    country,
    updateFrequency,
    toggleChannel,
    handleValidate,
    handlePostpone,
    travelMode,
    travelUntil,
    setTravelUntil,
    handleTravelToggle,
    handleToggleActive,
  } = useLifeCheckConfig();

  // "Change dates": leave travel mode, then pick the new return date.
  async function changeTravelDates() {
    await handleTravelToggle();
    requestAnimationFrame(() =>
      document.getElementById("travel-until")?.focus(),
    );
  }

  return (
    <div className="max-w-screen-2xl mx-auto">
      <header className="mb-10 max-w-2xl">
        <h1 className="text-headline-lg text-primary mb-3">Life Check</h1>
        <p className="text-body-lg text-on-surface-variant">
          {t("page.intro")}
        </p>
      </header>

      {config === undefined ? (
        <Loader />
      ) : (
        <div className="space-y-8">
          {travelMode ? (
            <div className="flex justify-center rounded-[16px] border border-border-default bg-bg-surface">
              <TravelModeOnMessage
                until={config?.travelModeUntil ?? null}
                onChangeDates={() => void changeTravelDates()}
                onTurnOff={() => void handleTravelToggle()}
              />
            </div>
          ) : null}

          {activeCycle ? (
            <ActiveCycleBanner
              status={activeCycle.status}
              onValidate={handleValidate}
              onPostpone={handlePostpone}
            />
          ) : (
            config && (
              <NextCheckInCard
                nextCheckAt={config.nextCheckAt}
                paused={config.paused}
                onReset={handleValidate}
              />
            )
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              <FrequencySelector value={frequency} onChange={updateFrequency} />
              <ChannelList
                channels={channels}
                onToggle={toggleChannel}
                phoneNumber={phoneNumber}
                defaultCountry={country as CountryCode | undefined}
              />
              <ReleasePolicySettings />
              <ReleaseIntroductionEditor />
              {config ? (
                <section className="bg-surface-container-low rounded-sm p-6 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-headline-sm text-primary">
                      {t("pause.title")}
                    </h3>
                    <p className="text-body-md text-on-surface-variant">
                      {t("pause.description")}
                    </p>
                  </div>
                  <Switch
                    checked={config.isActive}
                    disabled={travelMode}
                    onCheckedChange={(active) =>
                      void handleToggleActive(active)
                    }
                    aria-label={t("pause.title")}
                  />
                </section>
              ) : null}
              {travelMode ? null : (
                <TravelModeSection
                  until={travelUntil}
                  onUntilChange={setTravelUntil}
                  onToggle={() => void handleTravelToggle()}
                />
              )}
            </div>

            <EscalationTimeline
              channels={channels}
              frequency={frequency}
              confirmationThreshold={config?.confirmationThreshold ?? 2}
              confirmationWindowDays={config?.confirmationWindowDays ?? 7}
              travelModeEnabled={config?.travelModeEnabled ?? false}
              travelModeUntil={config?.travelModeUntil}
            />
          </div>

          <ReleaseOverview />

          <LifeCheckHistory />
        </div>
      )}
    </div>
  );
}

// Surfaces the otherwise-silent inactivity counter as a live countdown so users
// always know a deadline is running and what resets it. The "I'm well" button
// is the explicit in-app reply that resets the countdown (validateCycle → tap).
function NextCheckInCard({
  nextCheckAt,
  paused,
  onReset,
}: {
  nextCheckAt: number;
  /** Server-side kill switch: the counting is frozen, so don't show a ticking clock. */
  paused: boolean;
  onReset: () => void;
}) {
  const t = useTranslations("lifeCheck");
  return (
    <div className="mb-8 bg-surface-container-low rounded-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
      <div>
        <p className="text-label-md text-on-surface-variant mb-4">
          {t("nextCheckIn.label")}
        </p>
        {paused ? (
          <p className="text-headline-sm text-on-surface">
            {t("nextCheckIn.paused")}
          </p>
        ) : (
          <Countdown target={nextCheckAt} />
        )}
      </div>
      <div className="flex flex-col gap-3 sm:items-end sm:max-w-xs">
        <p className="text-body-md text-on-surface-variant sm:text-right">
          {t("nextCheckIn.description")}
        </p>
        <Button
          variant="default"
          onClick={onReset}
          className="w-full sm:w-auto"
        >
          {t("nextCheckIn.reset")}
        </Button>
      </div>
    </div>
  );
}
