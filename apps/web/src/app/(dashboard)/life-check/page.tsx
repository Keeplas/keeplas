"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ErrorAlert,
  Loader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@keeplas/ui";
import { LifeCheckHistory } from "./life-check-history";
import { ActiveCycleBanner } from "./sections/active-cycle-banner";
import { ChannelList } from "./sections/channel-list";
import { EscalationTimeline } from "./sections/escalation-timeline";
import { FrequencySelector } from "./sections/frequency-selector";
import { ScenarioPanel } from "./sections/scenario-panel";
import { useLifeCheckConfig } from "./sections/use-life-check-config";

type TabValue = "monitoring" | "reaction";

function isTabValue(value: string | null): value is TabValue {
  return value === "monitoring" || value === "reaction";
}

export default function ContinuityProtocolPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<TabValue>(
    isTabValue(initialTab) ? initialTab : "monitoring",
  );

  useEffect(() => {
    const current = searchParams.get("tab");
    if (current !== tab) {
      const next = new URLSearchParams(searchParams.toString());
      next.set("tab", tab);
      router.replace(`/life-check?${next.toString()}`, { scroll: false });
    }
  }, [tab, router, searchParams]);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <header className="mb-10 max-w-2xl">
        <h1 className="text-headline-lg text-primary mb-3">
          Continuity Protocol
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          A single protocol in two halves: monitoring checks whether you&apos;re
          still around, the reaction layer decides what fires when silence is
          confirmed. Pause everything from{" "}
          <a
            href="/settings/continuity"
            className="underline font-medium text-secondary"
          >
            Settings → Continuity Protocol
          </a>
          .
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => isTabValue(v) && setTab(v)}
        className="space-y-8"
      >
        <TabsList>
          <TabsTrigger value="monitoring">Life Check</TabsTrigger>
          <TabsTrigger value="reaction">Scenario Engine</TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring">
          <MonitoringPanel />
        </TabsContent>

        <TabsContent value="reaction">
          <ScenarioPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MonitoringPanel() {
  const {
    config,
    activeCycle,
    frequency,
    channels,
    saving,
    error,
    saved,
    updateFrequency,
    toggleChannel,
    handleValidate,
    handlePostpone,
  } = useLifeCheckConfig();

  if (config === undefined) {
    return <Loader />;
  }

  return (
    <div className="space-y-8">
      {activeCycle && (
        <ActiveCycleBanner
          status={activeCycle.status}
          currentLevel={activeCycle.currentLevel}
          onValidate={handleValidate}
          onPostpone={handlePostpone}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <FrequencySelector value={frequency} onChange={updateFrequency} />
          <ChannelList channels={channels} onToggle={toggleChannel} />
        </div>

        <EscalationTimeline channels={channels} frequency={frequency} />
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between bg-surface-container-high p-6 rounded-2xl gap-6">
        <div>
          <h3 className="text-headline-sm text-primary">
            Verification Profile
          </h3>
          <p className="text-body-md text-on-surface-variant">
            Changes save automatically and take effect across all linked vaults
            immediately.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          {error && <ErrorAlert message={error} />}
          {saving && (
            <span className="text-body-md text-on-surface-variant font-medium self-center">
              Saving…
            </span>
          )}
          {saved && !saving && (
            <span className="text-body-md text-secondary font-medium self-center">
              Saved ✓
            </span>
          )}
        </div>
      </div>

      <LifeCheckHistory />
    </div>
  );
}
