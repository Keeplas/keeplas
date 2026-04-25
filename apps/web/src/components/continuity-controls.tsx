"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { ErrorAlert, Loader, Switch } from "@keeplas/ui";
import { getErrorMessage } from "@/lib/utils";
import { TravelModeSection } from "@/app/(dashboard)/life-check/sections/travel-mode-section";

/**
 * Master controls for the Continuity Protocol — pauses both Life Check AND
 * the Scenario Engine in lock-step. Lives in Settings so the day-to-day
 * pages stay focused on configuration; a small status badge in the global
 * sidebar surfaces the current state at all times.
 */
export function ContinuityControls() {
  const config = useQuery(api.life_check.getConfig);
  const scenarioData = useQuery(api.scenarios.getScenario);
  const toggleActive = useMutation(api.life_check.toggleActive);
  const toggleTravelMode = useMutation(api.life_check.toggleTravelMode);
  const setSafePause = useMutation(api.scenarios.setSafePause);

  const [travelUntil, setTravelUntil] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (config?.travelModeUntil) {
      setTravelUntil(
        new Date(config.travelModeUntil).toISOString().split("T")[0]
      );
    }
  }, [config?.travelModeUntil]);

  if (config === undefined || scenarioData === undefined) {
    return <Loader />;
  }

  const isConfigured = config !== null;
  const lifeCheckOn = config?.isActive ?? false;
  const scenarioPaused = scenarioData?.scenario?.isSafePauseActive ?? false;
  const travelModeOn = config?.travelModeEnabled ?? false;
  const masterActive = lifeCheckOn && !scenarioPaused && !travelModeOn;

  async function handleMasterToggle(nextActive: boolean) {
    setError("");
    try {
      await Promise.all([
        toggleActive({ isActive: nextActive }),
        setSafePause({ paused: !nextActive }),
      ]);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update Continuity Protocol"));
    }
  }

  async function handleTravelToggle() {
    setError("");
    if (!travelModeOn && !travelUntil) return;
    const enabling = !travelModeOn;
    const until =
      enabling && travelUntil ? new Date(travelUntil).getTime() : undefined;
    try {
      await Promise.all([
        toggleTravelMode({ enabled: enabling, until }),
        setSafePause({ paused: enabling, until }),
      ]);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to toggle Travel Mode"));
    }
  }

  const statusLabel = travelModeOn
    ? "Travel Mode"
    : masterActive
      ? "Active"
      : "Paused";

  if (!isConfigured) {
    return (
      <div className="bg-surface-container-low p-6 rounded-2xl">
        <p className="text-body-md text-on-surface-variant">
          Continuity Protocol is not configured yet. Visit{" "}
          <a href="/life-check" className="underline font-medium">
            Life Check
          </a>{" "}
          to set it up.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="bg-surface-container-low p-6 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-headline-sm text-primary">
            Continuity Protocol
          </h3>
          <p className="text-body-md text-on-surface-variant">
            Pause both halves at once — Life Check stops escalating, the
            Scenario Engine stops dispatching. Status:{" "}
            <strong className="text-primary">{statusLabel}</strong>.
          </p>
        </div>
        <Switch
          checked={masterActive}
          disabled={travelModeOn}
          onCheckedChange={handleMasterToggle}
        />
      </section>

      {error && <ErrorAlert message={error} />}

      <TravelModeSection
        enabled={travelModeOn}
        until={travelUntil}
        onUntilChange={setTravelUntil}
        onToggle={handleTravelToggle}
      />
    </div>
  );
}
