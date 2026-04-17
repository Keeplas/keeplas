"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { getErrorMessage } from "@/lib/utils";
import {
  DEFAULT_CHANNELS,
  type ChannelConfig,
  type ChannelType,
  type Frequency,
} from "./constants";

export function useLifeCheckConfig() {
  const config = useQuery(api.life_check.getConfig);
  const activeCycle = useQuery(api.life_check.getActiveCycle);
  const saveConfig = useMutation(api.life_check.saveConfig);
  const toggleTravelMode = useMutation(api.life_check.toggleTravelMode);
  const validateCycle = useMutation(api.life_check.validateCycle);
  const postponeCycle = useMutation(api.life_check.postponeCycle);
  const toggleActive = useMutation(api.life_check.toggleActive);

  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [channels, setChannels] = useState<ChannelConfig[]>(DEFAULT_CHANNELS);
  const [travelMode, setTravelMode] = useState(false);
  const [travelUntil, setTravelUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!config) return;

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
      setError(getErrorMessage(err, "Failed to save configuration"));
    } finally {
      setSaving(false);
    }
  }

  async function handleTravelToggle() {
    if (!travelMode && !travelUntil) return;
    try {
      await toggleTravelMode({
        enabled: !travelMode,
        until:
          !travelMode && travelUntil
            ? new Date(travelUntil).getTime()
            : undefined,
      });
      setTravelMode(!travelMode);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to toggle travel mode"));
    }
  }

  async function handleValidate() {
    try {
      await validateCycle({ method: "tap" });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to validate"));
    }
  }

  async function handlePostpone(duration: "48h" | "7d") {
    try {
      await postponeCycle({ duration });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to postpone"));
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

  function updateFrequency(next: Frequency) {
    setFrequency(next);
    setSaved(false);
  }

  async function handleToggleActive(nextActive: boolean) {
    try {
      await toggleActive({ isActive: nextActive });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to toggle Life Check"));
    }
  }

  return {
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
  };
}
