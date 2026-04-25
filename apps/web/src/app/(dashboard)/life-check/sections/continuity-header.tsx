"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { ErrorAlert, Switch } from "@keeplas/ui";
import { getErrorMessage } from "@/lib/utils";
import { TravelModeSection } from "./travel-mode-section";

/**
 * Page-level header for the Continuity Protocol. Owns the master "Active"
 * toggle and Travel Mode controls — both pause Life Check AND the Scenario
 * Engine in lock-step so the user never has to remember to flip two
 * switches before going off-grid.
 */
export function ContinuityHeader() {
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

  const isConfigured = config !== null && config !== undefined;
  const lifeCheckOn = config?.isActive ?? false;
  const scenarioPaused = scenarioData?.scenario?.isSafePauseActive ?? false;
  const travelModeOn = config?.travelModeEnabled ?? false;
  // Master "Active" = Life Check enabled AND Scenario engine not paused.
  // Travel Mode forces both halves to pause.
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

  return (
    <div className="space-y-6 mb-10">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-headline-lg text-primary mb-3">
            Continuity Protocol
          </h1>
          <p className="text-body-lg text-on-surface-variant">
            A single protocol in two halves: monitoring checks whether
            you&apos;re still around, the reaction layer decides what fires
            when silence is confirmed.
          </p>
        </div>

        {isConfigured && (
          <div className="bg-surface-container-low p-5 rounded-2xl flex items-center gap-5 shrink-0">
            <div className="flex flex-col text-right">
              <span className="text-headline-sm text-primary">
                {statusLabel}
              </span>
              <span className="text-label-md text-on-surface-variant">
                Continuity Protocol
              </span>
            </div>
            <Switch
              checked={masterActive}
              disabled={travelModeOn}
              onCheckedChange={handleMasterToggle}
            />
          </div>
        )}
      </div>

      {error && <ErrorAlert message={error} />}

      {isConfigured && (
        <TravelModeSection
          enabled={travelModeOn}
          until={travelUntil}
          onUntilChange={setTravelUntil}
          onToggle={handleTravelToggle}
        />
      )}
    </div>
  );
}
