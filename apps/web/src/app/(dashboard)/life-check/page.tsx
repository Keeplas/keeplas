"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Switch, Spinner, ErrorAlert, DatePicker } from "@keeplas/ui";
import { LifeCheckHistory } from "./life-check-history";

const FREQUENCIES = [
  { value: "weekly" as const, label: "7", unit: "Days", description: "Active" },
  { value: "monthly" as const, label: "30", unit: "Days", description: "Recommended" },
  { value: "quarterly" as const, label: "90", unit: "Days", description: "Relaxed" },
];

type ChannelType = "push" | "email" | "first_responder";

interface ChannelConfig {
  type: ChannelType;
  label: string;
  description: string;
  iconPath: string;
  delayHours: number;
  isEnabled: boolean;
  order: number;
}

const DEFAULT_CHANNELS: ChannelConfig[] = [
  {
    type: "push",
    label: "App Push Notification",
    description: "Encrypted mobile ping — tap to confirm",
    iconPath:
      "M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0",
    delayHours: 24,
    isEnabled: true,
    order: 1,
  },
  {
    type: "email",
    label: "Email Verification",
    description: "Sent to primary & recovery address",
    iconPath:
      "M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75",
    delayHours: 48,
    isEnabled: true,
    order: 2,
  },
  {
    type: "first_responder",
    label: "First Responder Alert",
    description: "Your designated First Responder is notified",
    iconPath:
      "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
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
          config.activeChannels.map((ch) => {
            const def = DEFAULT_CHANNELS.find((d) => d.type === ch.type);
            return {
              type: ch.type as ChannelType,
              label: def?.label ?? ch.type,
              description: def?.description ?? "",
              iconPath: def?.iconPath ?? DEFAULT_CHANNELS[0].iconPath,
              delayHours: ch.delayHours,
              isEnabled: ch.isEnabled,
              order: ch.order,
            };
          })
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
      setError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  async function handleTravelToggle() {
    if (!travelMode && !travelUntil) return;
    try {
      await toggleTravelMode({
        enabled: !travelMode,
        until: !travelMode && travelUntil ? new Date(travelUntil).getTime() : undefined,
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
    <div className="max-w-6xl mx-auto">
      {/* Header */}
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
                toggleActive({ isActive: !isActive });
              }}
            />
          </div>
        )}
      </header>

      {/* Active Cycle Banner */}
      {activeCycle && (
        <div className="mb-8 bg-primary-container text-on-primary-container rounded-2xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-headline font-bold text-on-primary mb-1">
                Life Check Active
              </h3>
              <p className="text-sm text-on-primary-container/90">
                {activeCycle.status === "running"
                  ? "Please confirm you are well."
                  : "Escalation in progress."}
              </p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-secondary text-on-secondary font-bold uppercase tracking-widest">
              Level {activeCycle.currentLevel}
            </span>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={handleValidate}
              className="bg-secondary-fixed text-on-secondary-fixed font-bold py-2.5 px-5 rounded-xl text-sm cursor-pointer hover:scale-[1.02] transition-transform"
            >
              I&apos;m alive
            </button>
            <button
              onClick={() => handlePostpone("48h")}
              className="bg-surface-container-lowest/10 text-on-primary border border-on-primary/20 font-bold py-2.5 px-5 rounded-xl text-sm cursor-pointer"
            >
              Postpone 48h
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left — Configuration */}
        <div className="lg:col-span-7 space-y-6">
          {/* Inactivity Threshold */}
          <section className="bg-surface-container-low rounded-2xl p-6 relative overflow-hidden">
            <h3 className="text-lg font-bold font-headline text-primary mb-1.5 flex items-center gap-2">
              <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Inactivity Threshold
            </h3>
            <p className="text-on-surface-variant text-xs md:text-sm mb-6">
              The period of total silence before the verification sequence begins.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {FREQUENCIES.map((freq) => {
                const selected = frequency === freq.value;
                return (
                  <button
                    key={freq.value}
                    onClick={() => {
                      setFrequency(freq.value);
                      setSaved(false);
                    }}
                    className={
                      selected
                        ? "flex flex-col items-center justify-center p-5 bg-secondary text-on-secondary rounded-xl shadow-lg scale-[1.03] transition-transform cursor-pointer"
                        : "flex flex-col items-center justify-center p-5 bg-surface-container-highest rounded-xl hover:scale-[1.03] transition-transform cursor-pointer group"
                    }
                  >
                    <span className={`text-2xl font-black font-headline ${selected ? "" : "text-primary group-hover:text-secondary"}`}>
                      {freq.label}
                    </span>
                    <span className={`text-[10px] uppercase font-bold tracking-tighter mt-1 ${selected ? "opacity-80" : "text-on-surface-variant"}`}>
                      {freq.unit}
                    </span>
                    <span className={`text-[9px] uppercase tracking-widest mt-1 ${selected ? "opacity-60" : "text-on-surface-variant/60"}`}>
                      {freq.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Verification Channels */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold font-headline text-primary mb-5 flex items-center gap-2">
              <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
              Verification Channels
            </h3>
            <div className="space-y-4">
              {channels
                .sort((a, b) => a.order - b.order)
                .map((ch) => (
                  <div
                    key={ch.type}
                    className={`flex items-center justify-between p-3 bg-surface-container-low rounded-xl ${ch.isEnabled ? "" : "opacity-60"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 flex items-center justify-center bg-surface-container-lowest rounded-lg shadow-sm">
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={ch.iconPath} />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-primary text-sm">{ch.label}</p>
                        <p className="text-xs text-on-surface-variant">{ch.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={ch.isEnabled}
                      onCheckedChange={() => toggleChannel(ch.type)}
                    />
                  </div>
                ))}
            </div>
          </section>

          {/* Travel Mode */}
          <section className="bg-surface-container-low rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-headline font-bold text-lg text-primary flex items-center gap-2">
                  <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5M3.75 4.5h16.5M12 4.5v15" />
                  </svg>
                  Travel Mode
                </h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Suspend Life Check for up to 90 days when traveling.
                </p>
              </div>
            </div>

            {travelMode ? (
              <div className="space-y-3">
                <div className="p-4 bg-secondary/10 rounded-xl">
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
                  <label
                    htmlFor="travel-until"
                    className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold block mb-1"
                  >
                    Return date
                  </label>
                  <DatePicker
                    id="travel-until"
                    value={travelUntil}
                    onChange={setTravelUntil}
                    min={new Date().toISOString().split("T")[0]}
                    max={new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                    placeholder="Pick your return date"
                  />
                </div>
                <button
                  onClick={handleTravelToggle}
                  disabled={!travelUntil}
                  className="px-5 py-3 rounded-xl bg-secondary text-on-secondary text-sm font-bold cursor-pointer disabled:opacity-60"
                >
                  Enable
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Right — Escalation Timeline */}
        <aside className="lg:col-span-5">
          <div className="vault-gradient rounded-2xl p-8 text-on-primary h-full shadow-2xl relative overflow-hidden">
            <h3 className="text-xl font-black font-headline mb-1.5 tracking-tight">
              Escalation Protocol
            </h3>
            <p className="text-on-primary-container text-xs md:text-sm mb-10">
              Visual logic of the fail-safe trigger.
            </p>

            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-secondary/30" />

              <div className="space-y-8">
                {/* J+0 */}
                <div className="relative pl-12">
                  <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-secondary ring-4 ring-secondary/20 z-10" />
                  <p className="font-bold text-base mb-1 text-on-primary">J+0: Verification Window Opens</p>
                  <p className="text-on-primary-container text-xs md:text-sm">
                    A discreet notification is sent to your active devices. No one else is notified.
                  </p>
                </div>

                {/* J+7 */}
                <div className="relative pl-12">
                  <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-secondary/50 z-10" />
                  <p className="font-bold text-base mb-1 text-on-primary/90">J+7: Secondary Reach-out</p>
                  <p className="text-on-primary-container text-xs md:text-sm">
                    Alternative channels (SMS/Recovery Email) are utilized. Frequency increases to daily.
                  </p>
                </div>

                {/* J+25 */}
                <div className="relative pl-12">
                  <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-error/50 z-10" />
                  <p className="font-bold text-base mb-1 text-error-container">J+25: Critical Alert</p>
                  <p className="text-on-primary-container text-xs md:text-sm font-medium">
                    Final countdown. This is the last chance to abort the automated protocol.
                  </p>
                </div>

                {/* J+30 */}
                <div className="relative pl-12">
                  <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-error ring-4 ring-error/30 z-10" />
                  <div className="bg-on-primary/5 p-4 rounded-xl backdrop-blur-sm">
                    <p className="font-black text-lg mb-1.5 text-on-primary">J+30: Protocol Triggered</p>
                    <p className="text-on-primary-container text-xs md:text-sm mb-3">
                      The Vault decrypts. Access keys are released to your Trusted Contacts automatically.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="px-3 py-1 bg-secondary text-on-secondary text-[10px] font-bold rounded-full uppercase tracking-tighter">
                        Legal Legacy
                      </span>
                      <span className="px-3 py-1 bg-secondary text-on-secondary text-[10px] font-bold rounded-full uppercase tracking-tighter">
                        Health Directives
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-on-primary/5 rounded-xl ghost-border">
              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 text-secondary-fixed shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
                </svg>
                <p className="text-[11px] text-on-primary-container leading-relaxed italic">
                  Keeplas uses zero-knowledge encryption. Even our system administrators cannot abort a triggered protocol once the J+30 threshold is crossed without your master key.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Final action row */}
      <div className="mt-8 flex flex-col md:flex-row items-center justify-between bg-surface-container-high p-6 rounded-2xl gap-6">
        <div>
          <h3 className="font-headline font-black text-primary text-lg">
            {isConfigured ? "Update Verification Profile" : "Confirm Verification Profile"}
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
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 vault-gradient text-on-primary font-headline font-extrabold text-sm rounded-xl shadow-xl hover:scale-[1.03] active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
          >
            {saving
              ? "Saving..."
              : isConfigured
                ? "Update Life Check"
                : "Enable Life Check"}
          </button>
        </div>
      </div>

      <div className="mt-12">
        <LifeCheckHistory />
      </div>
    </div>
  );
}
