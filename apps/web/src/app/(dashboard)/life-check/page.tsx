import { InfoCallout, Loader, Switch, type CountryCode } from "@keeplas/ui";
import { ShellPage } from "@/components/shell/shell-page";
import { Panel, RowText } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { LifeCheckHistory } from "./life-check-history";
import { ActiveCycleBanner } from "./sections/active-cycle-banner";
import { ChannelList } from "./sections/channel-list";
import { EscalationTimeline } from "./sections/escalation-timeline";
import { FrequencySelector } from "./sections/frequency-selector";
import { NextCheckInCard } from "./sections/next-check-in-card";
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
    <ShellPage title={t("page.title")} subtitle={t("page.intro")}>
      {config === undefined ? (
        <Loader />
      ) : (
        <>
          {travelMode ? (
            <Panel className="flex justify-center">
              <TravelModeOnMessage
                until={config?.travelModeUntil ?? null}
                onChangeDates={() => void changeTravelDates()}
                onTurnOff={() => void handleTravelToggle()}
              />
            </Panel>
          ) : null}

          {activeCycle ? (
            <ActiveCycleBanner
              status={activeCycle.status}
              onValidate={handleValidate}
              onPostpone={handlePostpone}
            />
          ) : null}

          <div className="grid items-start gap-[20px] lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="flex flex-col gap-[20px]">
              {config ? (
                <NextCheckInCard
                  nextCheckAt={config.nextCheckAt}
                  lastCheckAt={config.lastCheckAt}
                  paused={config.paused}
                  onReset={handleValidate}
                />
              ) : null}
              <FrequencySelector value={frequency} onChange={updateFrequency} />
              {travelMode ? null : (
                <TravelModeSection
                  until={travelUntil}
                  onUntilChange={setTravelUntil}
                  onToggle={() => void handleTravelToggle()}
                />
              )}
              <InfoCallout icon={ICON_PATHS.shieldCheck}>
                {t("note")}
              </InfoCallout>
              <ChannelList
                channels={channels}
                onToggle={toggleChannel}
                phoneNumber={phoneNumber}
                defaultCountry={country as CountryCode | undefined}
              />
              <ReleasePolicySettings />
              <ReleaseIntroductionEditor />
              {config ? (
                <Panel className="flex items-center gap-[12px] p-[20px]">
                  <RowText
                    title={t("pause.title")}
                    description={t("pause.description")}
                  />
                  <Switch
                    checked={config.isActive}
                    disabled={travelMode}
                    onCheckedChange={(active) =>
                      void handleToggleActive(active)
                    }
                    aria-label={t("pause.title")}
                  />
                </Panel>
              ) : null}
            </div>

            <div className="flex flex-col gap-[20px]">
              <EscalationTimeline
                channels={channels}
                frequency={frequency}
                confirmationThreshold={config?.confirmationThreshold ?? 2}
                confirmationWindowDays={config?.confirmationWindowDays ?? 7}
                travelModeEnabled={config?.travelModeEnabled ?? false}
                travelModeUntil={config?.travelModeUntil}
              />
              <ReleaseOverview />
              <LifeCheckHistory />
            </div>
          </div>
        </>
      )}
    </ShellPage>
  );
}
