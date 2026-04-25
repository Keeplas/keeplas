"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
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
import { ContinuityHeader } from "./sections/continuity-header";
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
    isTabValue(initialTab) ? initialTab : "monitoring"
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
      <ContinuityHeader />

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
    handleSave,
    handleValidate,
    handlePostpone,
  } = useLifeCheckConfig();

  if (config === undefined) {
    return <Loader />;
  }

  const isConfigured = config !== null;

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

        <EscalationTimeline />
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between bg-surface-container-high p-6 rounded-2xl gap-6">
        <div>
          <h3 className="text-headline-sm text-primary">
            {isConfigured
              ? "Update Verification Profile"
              : "Confirm Verification Profile"}
          </h3>
          <p className="text-body-md text-on-surface-variant">
            Settings take effect across all linked vaults immediately.
          </p>
        </div>
        <div className="flex gap-3">
          {error && <ErrorAlert message={error} />}
          {saved && (
            <span className="text-body-md text-secondary font-medium self-center">
              Saved ✓
            </span>
          )}
          <Button
            variant="vault"
            size="md"
            onClick={handleSave}
            disabled={saving}
            className="shadow-xl cursor-pointer"
          >
            {saving
              ? "Saving..."
              : isConfigured
                ? "Update Life Check"
                : "Enable Life Check"}
          </Button>
        </div>
      </div>

      <LifeCheckHistory />
    </div>
  );
}
