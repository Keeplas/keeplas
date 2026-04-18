"use client";

import { Button, ErrorAlert, Loader, Switch } from "@keeplas/ui";
import { LifeCheckHistory } from "./life-check-history";
import { ActiveCycleBanner } from "./sections/active-cycle-banner";
import { ChannelList } from "./sections/channel-list";
import { EscalationTimeline } from "./sections/escalation-timeline";
import { FrequencySelector } from "./sections/frequency-selector";
import { TravelModeSection } from "./sections/travel-mode-section";
import { useLifeCheckConfig } from "./sections/use-life-check-config";

export default function LifeCheckPage() {
  const {
    config,
    activeCycle,
    frequency,
    channels,
    travelMode,
    travelUntil,
    saving,
    error,
    saved,
    setTravelUntil,
    updateFrequency,
    toggleChannel,
    handleSave,
    handleTravelToggle,
    handleValidate,
    handlePostpone,
    handleToggleActive,
  } = useLifeCheckConfig();

  if (config === undefined) {
    return <Loader />;
  }

  const isConfigured = config !== null;
  const isActive = config?.isActive ?? false;

  return (
    <div className="max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="max-w-2xl">
          <h1 className="font-headline font-extrabold text-3xl md:text-4xl text-primary tracking-tight leading-tight mb-3">
            Life Continuity
            <br />
            <span className="text-secondary">Verification Engine</span>
          </h1>
          <p className="text-on-surface-variant text-sm md:text-base max-w-xl">
            Configure your automated proof-of-life protocol. If you are unresponsive, Keeplas securely executes your legacy directives.
          </p>
        </div>

        {isConfigured && (
          <div className="bg-surface-container-low p-4 rounded-2xl flex items-center gap-5 shadow-sm shrink-0">
            <div className="flex flex-col">
              <span className="font-headline font-bold text-primary text-sm">
                {travelMode ? "Travel Mode" : isActive ? "Active" : "Paused"}
              </span>
              <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                Pause Life Check
              </span>
            </div>
            <Switch
              checked={!isActive || travelMode}
              onCheckedChange={(checked) => {
                if (checked && !isActive) return;
                handleToggleActive(!isActive);
              }}
            />
          </div>
        )}
      </header>

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
          <TravelModeSection
            enabled={travelMode}
            until={travelUntil}
            onUntilChange={setTravelUntil}
            onToggle={handleTravelToggle}
          />
        </div>

        <EscalationTimeline />
      </div>

      <div className="mt-8 flex flex-col md:flex-row items-center justify-between bg-surface-container-high p-6 rounded-2xl gap-6">
        <div>
          <h3 className="font-headline font-black text-primary text-lg">
            {isConfigured
              ? "Update Verification Profile"
              : "Confirm Verification Profile"}
          </h3>
          <p className="text-on-surface-variant text-xs md:text-sm">
            Settings take effect across all linked vaults immediately.
          </p>
        </div>
        <div className="flex gap-3">
          {error && <ErrorAlert message={error} />}
          {saved && (
            <span className="text-sm text-secondary font-medium self-center">
              Saved ✓
            </span>
          )}
          <Button
            variant="vault"
            size="md"
            onClick={handleSave}
            disabled={saving}
            className="font-extrabold text-sm shadow-xl cursor-pointer"
          >
            {saving
              ? "Saving..."
              : isConfigured
                ? "Update Life Check"
                : "Enable Life Check"}
          </Button>
        </div>
      </div>

      <div className="mt-12">
        <LifeCheckHistory />
      </div>
    </div>
  );
}
