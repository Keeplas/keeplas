"use client";

import { Loader } from "@keeplas/ui";
import { LifeCheckHistory } from "./life-check-history";
import { ActiveCycleBanner } from "./sections/active-cycle-banner";
import { ChannelList } from "./sections/channel-list";
import { EscalationTimeline } from "./sections/escalation-timeline";
import { FrequencySelector } from "./sections/frequency-selector";
import { Countdown } from "./sections/countdown";
import { ReleaseOverview } from "./sections/release-overview";
import { ReleasePolicySettings } from "./sections/release-policy-settings";
import { useLifeCheckConfig } from "./sections/use-life-check-config";

export default function LifeCheckPage() {
  const {
    config,
    activeCycle,
    frequency,
    channels,
    updateFrequency,
    toggleChannel,
    handleValidate,
    handlePostpone,
  } = useLifeCheckConfig();

  return (
    <div className="max-w-screen-2xl mx-auto">
      <header className="mb-10 max-w-2xl">
        <h1 className="text-headline-lg text-primary mb-3">Life Check</h1>
        <p className="text-body-lg text-on-surface-variant">
          Keeplas periodically asks you to confirm you&apos;re well. If you stop
          responding, your trusted contacts confirm you&apos;re unavailable
          before your vault is released to them. Pause everything from{" "}
          <a
            href="/settings/continuity"
            className="underline font-medium text-secondary"
          >
            Settings → Continuity Protocol
          </a>
          .
        </p>
      </header>

      {config === undefined ? (
        <Loader />
      ) : (
        <div className="space-y-8">
          {activeCycle ? (
            <ActiveCycleBanner
              status={activeCycle.status}
              onValidate={handleValidate}
              onPostpone={handlePostpone}
            />
          ) : (
            config && <NextCheckInCard nextCheckAt={config.nextCheckAt} />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              <FrequencySelector value={frequency} onChange={updateFrequency} />
              <ChannelList channels={channels} onToggle={toggleChannel} />
              <ReleasePolicySettings />
            </div>

            <EscalationTimeline channels={channels} frequency={frequency} />
          </div>

          <ReleaseOverview />

          <LifeCheckHistory />
        </div>
      )}
    </div>
  );
}

// Surfaces the otherwise-silent inactivity counter as a live countdown so users
// always know a deadline is running and what resets it.
function NextCheckInCard({ nextCheckAt }: { nextCheckAt: number }) {
  return (
    <div className="mb-8 bg-surface-container-low rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
      <div>
        <p className="text-label-md text-on-surface-variant mb-4">
          Next check-in
        </p>
        <Countdown target={nextCheckAt} />
      </div>
      <p className="text-body-md text-on-surface-variant sm:max-w-xs sm:text-right">
        We&apos;ll ask you to confirm you&apos;re well. Only your explicit reply
        resets the countdown — using the app doesn&apos;t.
      </p>
    </div>
  );
}
