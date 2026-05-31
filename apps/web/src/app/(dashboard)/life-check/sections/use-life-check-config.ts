"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { getErrorMessage } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import {
  DEFAULT_CHANNELS,
  type ChannelConfig,
  type ChannelType,
  type Frequency,
} from "./constants";

export function useLifeCheckConfig() {
  const t = useTranslations("lifeCheck.toasts");
  const config = useQuery(api.life_check.getConfig);
  const activeCycle = useQuery(api.life_check.getActiveCycle);
  const saveConfig = useAuditedMutation(api.life_check.saveConfig);
  const toggleTravelMode = useAuditedMutation(api.life_check.toggleTravelMode);
  const validateCycle = useAuditedMutation(api.life_check.validateCycle);
  const postponeCycle = useAuditedMutation(api.life_check.postponeCycle);
  const toggleActive = useAuditedMutation(api.life_check.toggleActive);
  const phoneStatus = useQuery(api.phone_verification.getMyStatus);
  const viewer = useQuery(api.users.viewer);

  // WhatsApp can only reach a phone the user has proven they own (OTP).
  const phoneVerified = phoneStatus?.verifiedAt != null;
  // Email check-ins need a verified address on file. Phone-only accounts have
  // none, so the email channel stays unverified for them (email is managed by
  // the auth provider and verified at login via OTP).
  const emailVerified =
    viewer?.email != null && viewer?.emailVerificationTime != null;

  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [channels, setChannels] = useState<ChannelConfig[]>(DEFAULT_CHANNELS);
  const [travelMode, setTravelMode] = useState(false);
  const [travelUntil, setTravelUntil] = useState("");

  // Seed the editable form from the server config the first time it resolves
  // (and again if it changes) by tracking the seeded source and adjusting
  // during render — the React-blessed alternative to a setState-in-effect sync.
  const [seededFrom, setSeededFrom] = useState(config);
  if (config && config !== seededFrom) {
    setSeededFrom(config);
    setFrequency(config.frequency);
    setTravelMode(config.travelModeEnabled);
    if (config.travelModeUntil) {
      setTravelUntil(
        new Date(config.travelModeUntil).toISOString().split("T")[0],
      );
    }
    if (config.activeChannels.length > 0) {
      setChannels(
        config.activeChannels.map((ch) => {
          const def = DEFAULT_CHANNELS.find((d) => d.type === ch.type);
          const isUpcoming = def?.isUpcoming ?? false;
          return {
            type: ch.type as ChannelType,
            label: def?.label ?? ch.type,
            description: def?.description ?? "",
            iconPath: def?.iconPath ?? DEFAULT_CHANNELS[0].iconPath,
            isEnabled: isUpcoming ? false : ch.isEnabled,
            order: ch.order,
            isUpcoming,
          };
        }),
      );
    }
  }

  async function persist(
    nextFrequency: Frequency,
    nextChannels: ChannelConfig[],
  ) {
    try {
      await saveConfig({
        frequency: nextFrequency,
        activeChannels: nextChannels.map((ch) => ({
          type: ch.type,
          order: ch.order,
          isEnabled: ch.isEnabled,
        })),
      });
    } catch (err) {
      toast({
        variant: "error",
        title: getErrorMessage(err, t("saveConfigError")),
      });
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
      toast({
        variant: "error",
        title: getErrorMessage(err, t("travelToggleError")),
      });
    }
  }

  async function handleValidate() {
    try {
      await validateCycle({ method: "tap" });
      toast({
        variant: "success",
        title: t("checkInTitle"),
        description: t("checkInDescription"),
      });
    } catch (err) {
      toast({
        variant: "error",
        title: getErrorMessage(err, t("validateError")),
      });
    }
  }

  async function handlePostpone(duration: "48h" | "7d") {
    try {
      await postponeCycle({ duration });
    } catch (err) {
      toast({
        variant: "error",
        title: getErrorMessage(err, t("postponeError")),
      });
    }
  }

  function toggleChannel(type: ChannelType) {
    if (channels.find((c) => c.type === type)?.isUpcoming) return;
    // An unverified contact can't receive a check-in — verify before enabling.
    if (type === "whatsapp" && !phoneVerified) return;
    if (type === "email" && !emailVerified) return;
    const next = channels.map((ch) =>
      ch.type === type ? { ...ch, isEnabled: !ch.isEnabled } : ch,
    );
    setChannels(next);
    void persist(frequency, next);
  }

  function updateFrequency(next: Frequency) {
    setFrequency(next);
    void persist(next, channels);
  }

  async function handleToggleActive(nextActive: boolean) {
    try {
      await toggleActive({ isActive: nextActive });
    } catch (err) {
      toast({
        variant: "error",
        title: getErrorMessage(err, t("toggleActiveError")),
      });
    }
  }

  // Surface per-channel verification so the UI can require it before enabling.
  // WhatsApp needs a phone proven via OTP; email needs a verified address.
  const verifiedChannels: ChannelConfig[] = channels.map((ch) => ({
    ...ch,
    isVerified:
      ch.type === "whatsapp"
        ? phoneVerified
        : ch.type === "email"
          ? emailVerified
          : true,
  }));

  return {
    config,
    activeCycle,
    frequency,
    channels: verifiedChannels,
    phoneNumber: phoneStatus?.phoneNumber ?? undefined,
    country: viewer?.country,
    travelMode,
    travelUntil,
    setTravelUntil,
    updateFrequency,
    toggleChannel,
    handleTravelToggle,
    handleValidate,
    handlePostpone,
    handleToggleActive,
  };
}
