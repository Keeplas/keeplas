"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Switch, Spinner, ErrorAlert } from "@keeplas/ui";
import { LifeCheckHistory } from "./life-check-history";

const FREQUENCIES = [
  {
    value: "weekly" as const,
    label: "Weekly",
    description: "For active lifestyles",
  },
  {
    value: "monthly" as const,
    label: "Monthly",
    description: "Recommended for most users",
  },
  {
    value: "quarterly" as const,
    label: "Quarterly",
    description: "Maximum exhaustive verification",
  },
];

type ChannelType = "push" | "email" | "first_responder";

interface ChannelConfig {
  type: ChannelType;
  label: string;
  description: string;
  delayHours: number;
  isEnabled: boolean;
  order: number;
}

const DEFAULT_CHANNELS: ChannelConfig[] = [
  {
    type: "push",
    label: "In-app notification",
    description: "Tap to confirm you are well",
    delayHours: 24,
    isEnabled: true,
    order: 1,
  },
  {
    type: "email",
    label: "Email",
    description: "Confirmation link sent to your email",
    delayHours: 48,
    isEnabled: true,
    order: 2,
  },
  {
    type: "first_responder",
    label: "First Responder",
    description: "Your designated First Responder is notified",
    delayHours: 24,
    isEnabled: true,
    order: 3,
  },
];

export default function LifeCheckPage() {
  const config = useQuery(api.life_check.getConfig);
  const activeCycle = useQuery(api.life_check.getActiveCycle);
  const saveConfig = useMutation(api.life_check.saveConfig);
  const toggleTravelMode = useMutation(api.life_check.toggleTravelMode);
  const validateCycle = useMutation(api.life_check.validateCycle);
  const postponeCycle = useMutation(api.life_check.postponeCycle);
  const toggleActive = useMutation(api.life_check.toggleActive);

  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "quarterly">("monthly");
  const [channels, setChannels] = useState<ChannelConfig[]>(DEFAULT_CHANNELS);
  const [travelMode, setTravelMode] = useState(false);
  const [travelUntil, setTravelUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Populate from existing config
  useEffect(() => {
    if (config) {
      setFrequency(config.frequency);
      setTravelMode(config.travelModeEnabled);
      if (config.travelModeUntil) {
        setTravelUntil(
          new Date(config.travelModeUntil).toISOString().split("T")[0]
        );
      }
      if (config.activeChannels.length > 0) {
        setChannels(
          config.activeChannels.map((ch) => ({
            type: ch.type as ChannelType,
            label:
              DEFAULT_CHANNELS.find((d) => d.type === ch.type)?.label ??
              ch.type,
            description:
              DEFAULT_CHANNELS.find((d) => d.type === ch.type)?.description ??
              "",
            delayHours: ch.delayHours,
            isEnabled: ch.isEnabled,
            order: ch.order,
          }))
        );
      }
    }
  }, [config]);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await saveConfig({
        frequency,
        activeChannels: channels.map((ch) => ({
          type: ch.type,
          order: ch.order,
          isEnabled: ch.isEnabled,
          delayHours: ch.delayHours,
        })),
      });
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save configuration"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleTravelToggle() {
    if (!travelMode && !travelUntil) return;
    try {
      await toggleTravelMode({
        enabled: !travelMode,
        until: !travelMode && travelUntil
          ? new Date(travelUntil).getTime()
          : undefined,
      });
      setTravelMode(!travelMode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle travel mode");
    }
  }

  async function handleValidate() {
    try {
      await validateCycle({ method: "tap" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to validate");
    }
  }

  async function handlePostpone(duration: "48h" | "7d") {
    try {
      await postponeCycle({ duration });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to postpone");
    }
  }

  function toggleChannel(type: ChannelType) {
    setChannels((prev) =>
      prev.map((ch) =>
        ch.type === type ? { ...ch, isEnabled: !ch.isEnabled } : ch
      )
    );
    setSaved(false);
  }

  function updateDelay(type: ChannelType, hours: number) {
    setChannels((prev) =>
      prev.map((ch) =>
        ch.type === type ? { ...ch, delayHours: hours } : ch
      )
    );
    setSaved(false);
  }

  if (config === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const isConfigured = config !== null;
  const isActive = config?.isActive ?? false;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <section className="mb-10">
        <span className="font-label text-secondary font-semibold uppercase tracking-[0.2em] text-xs mb-3 block">
          Proof of Life
        </span>
        <h1 className="font-headline text-primary text-4xl md:text-5xl font-extrabold tracking-tighter leading-tight">
          Life Check
        </h1>
        <p className="text-on-surface-variant text-lg max-w-md mt-4">
          Periodic verification that you are well. If all channels go
          unanswered, your trusted contacts are notified.
        </p>
      </section>

      {/* Active Cycle Banner */}
      {activeCycle && (
        <div className="mb-8 bg-primary-container rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-headline font-bold text-on-primary-container mb-1">
                Life Check Active
              </h3>
              <p className="text-sm text-on-primary-container/80">
                {activeCycle.status === "running"
                  ? "Please confirm you are well."
                  : "Escalation in progress."}
              </p>
            </div>
            <span className="text-xs px-2 py-1 rounded-lg bg-secondary-container text-on-secondary-container font-medium">
              Level {activeCycle.currentLevel}
            </span>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleValidate}
              className="vault-gradient text-on-primary font-bold py-2.5 px-5 rounded-xl text-sm cursor-pointer"
            >
              I&apos;m alive
            </button>
            <button
              onClick={() => handlePostpone("48h")}
              className="bg-surface-container text-primary font-bold py-2.5 px-5 rounded-xl text-sm cursor-pointer"
            >
              Postpone 48h
            </button>
          </div>
        </div>
      )}

      {/* Status & Toggle */}
      {isConfigured && (
        <div className="mb-8 flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
          <div>
            <span className="font-headline font-bold text-on-surface">
              Protection Status
            </span>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {isActive ? (
                <>
                  Active — Next check:{" "}
                  {config?.nextCheckAt
                    ? new Date(config.nextCheckAt).toLocaleDateString()
                    : "—"}
                </>
              ) : (
                "Paused — Life Check is currently disabled."
              )}
            </p>
          </div>
          <Switch
            checked={isActive}
            onCheckedChange={(checked) =>
              toggleActive({ isActive: checked })
            }
          />
        </div>
      )}

      {/* Configuration */}
      <div className="space-y-8">
        {/* Frequency */}
        <div className="bg-surface-container-low rounded-xl p-6">
          <h3 className="font-headline font-bold text-xl text-primary mb-4">
            Check Frequency
          </h3>
          <div className="space-y-2">
            {FREQUENCIES.map((freq) => (
              <label
                key={freq.value}
                className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-colors ${
                  frequency === freq.value
                    ? "bg-secondary-container"
                    : "bg-surface-container-lowest hover:bg-surface-container"
                }`}
              >
                <input
                  type="radio"
                  name="frequency"
                  value={freq.value}
                  checked={frequency === freq.value}
                  onChange={() => {
                    setFrequency(freq.value);
                    setSaved(false);
                  }}
                  className="w-4 h-4 accent-secondary"
                />
                <div>
                  <span
                    className={`font-medium ${
                      frequency === freq.value
                        ? "text-on-secondary-container"
                        : "text-on-surface"
                    }`}
                  >
                    {freq.label}
                  </span>
                  <p
                    className={`text-xs mt-0.5 ${
                      frequency === freq.value
                        ? "text-on-secondary-container/70"
                        : "text-on-surface-variant"
                    }`}
                  >
                    {freq.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Escalation Channels */}
        <div className="bg-surface-container-low rounded-xl p-6">
          <h3 className="font-headline font-bold text-xl text-primary mb-2">
            Escalation Channels
          </h3>
          <p className="text-sm text-on-surface-variant mb-4">
            If you don&apos;t respond to one channel, the next one is tried
            after the configured delay.
          </p>

          <div className="space-y-3">
            {channels
              .sort((a, b) => a.order - b.order)
              .map((ch, i) => (
                <div
                  key={ch.type}
                  className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <div>
                      <span className="font-medium text-on-surface text-sm">
                        {ch.label}
                      </span>
                      <p className="text-xs text-on-surface-variant">
                        {ch.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={ch.delayHours}
                      onChange={(e) =>
                        updateDelay(ch.type, Number(e.target.value))
                      }
                      className="text-xs px-2 py-1 bg-surface-container rounded-lg text-on-surface focus:outline-none"
                    >
                      <option value={12}>12h wait</option>
                      <option value={24}>24h wait</option>
                      <option value={48}>48h wait</option>
                    </select>
                    <Switch
                      checked={ch.isEnabled}
                      onCheckedChange={() => toggleChannel(ch.type)}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Travel Mode */}
        <div className="bg-surface-container-low rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-headline font-bold text-xl text-primary">
                Travel Mode
              </h3>
              <p className="text-sm text-on-surface-variant mt-1">
                Suspend Life Check for up to 90 days when traveling.
              </p>
            </div>
          </div>

          {travelMode ? (
            <div className="space-y-3">
              <div className="p-3 bg-secondary/5 rounded-lg">
                <p className="text-sm text-secondary font-medium">
                  Travel mode active
                  {travelUntil && <> until {new Date(travelUntil).toLocaleDateString()}</>}
                </p>
              </div>
              <button
                onClick={handleTravelToggle}
                className="text-sm px-4 py-2 rounded-xl bg-surface-container-high text-on-surface font-medium cursor-pointer"
              >
                Disable Travel Mode
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs text-on-surface-variant font-label block mb-1">
                  Return date
                </label>
                <input
                  type="date"
                  value={travelUntil}
                  onChange={(e) => setTravelUntil(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  max={
                    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                      .toISOString()
                      .split("T")[0]
                  }
                  className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                />
              </div>
              <button
                onClick={handleTravelToggle}
                disabled={!travelUntil}
                className="px-4 py-2 rounded-xl bg-secondary text-on-secondary text-sm font-bold cursor-pointer disabled:opacity-60"
              >
                Enable
              </button>
            </div>
          )}
        </div>

        {error && <ErrorAlert message={error} />}

        {saved && (
          <div className="bg-secondary/10 text-secondary rounded-xl p-4 text-sm font-medium">
            Life Check configuration saved successfully.
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="vault-gradient text-on-primary w-full py-4 rounded-xl font-headline font-bold tracking-wide hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
        >
          {saving
            ? "Saving..."
            : isConfigured
              ? "Update Configuration"
              : "Activate Life Check"}
        </button>
      </div>

      {/* Cycle History */}
      <div className="mt-12">
        <LifeCheckHistory />
      </div>
    </div>
  );
}
