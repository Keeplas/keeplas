"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { ErrorAlert, Loader, Switch } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";
import { getErrorMessage } from "@/lib/utils";
import { TravelModeSection } from "@/app/(dashboard)/life-check/sections/travel-mode-section";

/**
 * Master controls for the Life Check. Pause it entirely, or use Travel Mode to
 * pause with an auto-resume date. Lives in Settings so day-to-day pages stay
 * focused on configuration; a small status badge in the global sidebar surfaces
 * the current state at all times.
 */
export function ContinuityControls() {
  const t = useTranslations("lifeCheck");
  const config = useQuery(api.life_check.getConfig);
  const toggleActive = useMutation(api.life_check.toggleActive);
  const toggleTravelMode = useMutation(api.life_check.toggleTravelMode);

  const [travelUntil, setTravelUntil] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (config?.travelModeUntil) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing controlled date input to async server config; no clean derived alternative without changing the input contract.
      setTravelUntil(
        new Date(config.travelModeUntil).toISOString().split("T")[0],
      );
    }
  }, [config?.travelModeUntil]);

  if (config === undefined) {
    return <Loader />;
  }

  const isConfigured = config !== null;
  const lifeCheckOn = config?.isActive ?? false;
  const travelModeOn = config?.travelModeEnabled ?? false;
  const masterActive = lifeCheckOn && !travelModeOn;

  async function handleMasterToggle(nextActive: boolean) {
    setError("");
    try {
      await toggleActive({ isActive: nextActive });
    } catch (err) {
      setError(getErrorMessage(err, t("controls.toggleError")));
    }
  }

  async function handleTravelToggle() {
    setError("");
    if (!travelModeOn && !travelUntil) return;
    const enabling = !travelModeOn;
    const until =
      enabling && travelUntil ? new Date(travelUntil).getTime() : undefined;
    try {
      await toggleTravelMode({ enabled: enabling, until });
    } catch (err) {
      setError(getErrorMessage(err, t("controls.travelError")));
    }
  }

  const statusLabel = travelModeOn
    ? t("controls.statusTravel")
    : masterActive
      ? t("controls.statusActive")
      : t("controls.statusPaused");

  if (!isConfigured) {
    return (
      <div className="bg-surface-container-low p-6 rounded-2xl">
        <p className="text-body-md text-on-surface-variant">
          {t("controls.notConfigured")}{" "}
          <a href="/life-check" className="underline font-medium">
            {t("controls.notConfiguredLink")}
          </a>{" "}
          {t("controls.notConfiguredSuffix")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="bg-surface-container-low p-6 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-headline-sm text-primary">Life Check</h3>
          <p className="text-body-md text-on-surface-variant">
            {t("controls.pauseDescription")}{" "}
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
