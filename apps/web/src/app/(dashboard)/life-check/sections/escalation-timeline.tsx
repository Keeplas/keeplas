"use client";

import { HelpHint, Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { FREQUENCIES, type ChannelConfig, type Frequency } from "./constants";

// Mirrors CHECK_IN_WINDOW_DAYS / REMINDER_DAYS in
// packages/convex/life_check.ts. Keep in sync.
const CHECK_IN_WINDOW_DAYS = 15;
const REMINDER_DAYS = [3, 7, 10] as const;
// Owner-cancel grace once enough contacts confirm. Mirrors GRACE_MS in
// packages/convex/access_requests.ts (72h). Display-only.
const GRACE_HOURS = 72;

const TONE_STYLES = {
  active: "bg-secondary ring-4 ring-secondary/20",
  reminder: "bg-secondary/50",
  confirm: "bg-error/50",
  triggered: "bg-error ring-4 ring-error/30",
} as const;

type Tone = keyof typeof TONE_STYLES;

interface ReleasePolicy {
  confirmationThreshold: number;
  confirmationWindowDays: number;
  fallbackBehavior: "abort" | "release_anyway";
}

interface EscalationTimelineProps extends ReleasePolicy {
  channels: ChannelConfig[];
  frequency: Frequency;
  travelModeEnabled: boolean;
  travelModeUntil?: number;
}

interface PhaseStep {
  dayLabel: string;
  title: string;
  titleClass: string;
  description: React.ReactNode;
  tone: Tone;
  isFinal?: boolean;
  extra?: React.ReactNode;
  help?: string;
}

function cadenceLabel(frequency: Frequency): string {
  const freq = FREQUENCIES.find((f) => f.value === frequency);
  if (!freq) return "30 days";
  return `${freq.label} ${freq.unit.toLowerCase()}`;
}

function joinChannelLabels(channels: ChannelConfig[]): string {
  if (channels.length === 0) return "no channel";
  if (channels.length === 1) return channels[0].label;
  if (channels.length === 2)
    return `${channels[0].label} & ${channels[1].label}`;
  const head = channels
    .slice(0, -1)
    .map((c) => c.label)
    .join(", ");
  return `${head} & ${channels[channels.length - 1].label}`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

function buildSteps(
  channels: ChannelConfig[],
  policy: ReleasePolicy,
): PhaseStep[] {
  // Only channels that are enabled AND verified actually go out — an
  // unverified email/phone can't be reached, so keep it out of the timeline.
  const enabled = channels.filter((c) => c.isEnabled && c.isVerified !== false);
  const { confirmationThreshold, confirmationWindowDays, fallbackBehavior } =
    policy;

  return [
    {
      dayLabel: "D+0",
      title: "Check-in sent",
      titleClass: "text-on-primary",
      description: enabled.length
        ? `${joinChannelLabels(enabled)} go out together. Confirm with one tap, the email button, or a WhatsApp reply.`
        : "No channel enabled — turn one on so we can reach you.",
      tone: "active",
    },
    ...REMINDER_DAYS.map((day, i) => ({
      dayLabel: `D+${day}`,
      title: i === REMINDER_DAYS.length - 1 ? "Final reminder" : "Reminder",
      titleClass: "text-on-primary/90",
      description:
        "Still no reply — Keeplas reaches out again on every channel.",
      tone: "reminder" as Tone,
    })),
    {
      dayLabel: `D+${CHECK_IN_WINDOW_DAYS}`,
      title: "Continuity protocol begins",
      titleClass: "text-on-primary text-headline-sm",
      description:
        "No reply across the whole window. Keeplas now asks your trusted contacts to confirm you're unavailable — nothing is released yet.",
      tone: "confirm",
      help: "The check-in window has fully elapsed with no reply from you. Your trusted contacts are now asked to confirm you're unavailable. Nothing is decrypted or released at this point.",
      extra: (
        <div className="flex gap-2 flex-wrap mt-3">
          <span className="px-3 py-1 bg-secondary text-on-secondary text-label-md rounded-full">
            Trusted contacts notified
          </span>
        </div>
      ),
    },
    {
      dayLabel: "Then",
      title: "Trusted contacts confirm",
      titleClass: "text-on-primary/90",
      description: `At least ${plural(confirmationThreshold, "trusted contact")} must confirm they can't reach you, within ${confirmationWindowDays} days.`,
      tone: "confirm",
      help: `Set in Release policy: "Contacts that must confirm you're unavailable" (${confirmationThreshold}) and "Days they have to confirm" (${confirmationWindowDays} days). The contacts have that long to reach the required number.`,
    },
    {
      dayLabel: `+${GRACE_HOURS}h`,
      title: "Last chance to cancel",
      titleClass: "text-on-primary/90",
      description: `Once enough confirm, you still have ${GRACE_HOURS} hours to cancel before anything is released.`,
      tone: "confirm",
      help: `A fixed ${GRACE_HOURS}-hour safety window — it is NOT the "Days they have to confirm" setting. It starts the moment enough contacts confirm, and confirming you're well (tap, email, or WhatsApp) during it cancels the release.`,
    },
    {
      dayLabel: "Outcome",
      title: "Vault released",
      titleClass: "text-on-primary text-headline-sm",
      description:
        fallbackBehavior === "release_anyway"
          ? `Once ${plural(confirmationThreshold, "trusted contact")} confirm, your vault is released to them — and released anyway if the window passes without any confirmation.`
          : `Once ${plural(confirmationThreshold, "trusted contact")} confirm, your vault is released to them. If no one confirms in time, nothing is released.`,
      tone: "triggered",
      isFinal: true,
      help: 'Controlled by the "Release anyway if no one confirms" toggle in Release policy. On (recommended): release even if none confirm once the window passes. Off: release only if your contacts confirm.',
    },
  ];
}

function policyRecap({
  confirmationThreshold,
  confirmationWindowDays,
  fallbackBehavior,
}: ReleasePolicy): string {
  const fallback =
    fallbackBehavior === "release_anyway"
      ? "released anyway after the window"
      : "nothing released without confirmation";
  return `${plural(confirmationThreshold, "contact")} to confirm · ${confirmationWindowDays}-day window · ${fallback}`;
}

export function EscalationTimeline({
  channels,
  frequency,
  confirmationThreshold,
  confirmationWindowDays,
  fallbackBehavior,
  travelModeEnabled,
  travelModeUntil,
}: EscalationTimelineProps) {
  const policy: ReleasePolicy = {
    confirmationThreshold,
    confirmationWindowDays,
    fallbackBehavior,
  };
  const steps = buildSteps(channels, policy);
  const cadence = cadenceLabel(frequency);

  return (
    <aside className="lg:col-span-5">
      <div className="vault-gradient rounded-2xl p-8 text-on-primary h-full shadow-2xl relative overflow-hidden">
        <h3 className="text-headline-md mb-1.5 flex items-center gap-2">
          Escalation Protocol
          <HelpHint
            content="Every cadence period Keeplas asks you to confirm you're well. You then have a 15-day window with reminders to reply — by tapping in the app, clicking the email button, or replying on WhatsApp. Only an explicit reply resets the countdown; using the app does not. If the whole window passes in silence, Keeplas asks your trusted contacts to confirm you're unavailable before anything is released."
            className="text-on-primary/60 hover:text-secondary-fixed"
          />
        </h3>
        <p className="text-body-md text-on-primary-container mb-2">
          What happens after a missed check-in.
        </p>
        <p className="text-label-md text-on-primary-container/80 mb-8">
          Keeplas asks you to confirm every {cadence}.
        </p>

        {travelModeEnabled && (
          <div className="mb-8 p-4 bg-on-primary/5 rounded-xl ghost-border flex items-start gap-3">
            <Icon
              path={ICON_PATHS.globe}
              className="w-4 h-4 text-secondary-fixed shrink-0 mt-0.5"
            />
            <p className="text-body-md text-on-primary-container">
              Protocol paused — travel mode is on
              {travelModeUntil
                ? ` until ${new Date(travelModeUntil).toLocaleDateString()}`
                : ""}
              . No check-ins go out while it&apos;s active.
            </p>
          </div>
        )}

        <div className="relative">
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-secondary/30" />

          <div className="space-y-8">
            {steps.map((step) => (
              <div key={step.dayLabel} className="relative pl-12">
                <div
                  className={`absolute left-0 top-1 w-6 h-6 rounded-full z-10 ${TONE_STYLES[step.tone]}`}
                />
                {step.isFinal ? (
                  <div className="bg-on-primary/5 p-4 rounded-xl backdrop-blur-sm">
                    <p
                      className={`text-headline-sm mb-1.5 flex items-center gap-1.5 ${step.titleClass}`}
                    >
                      {step.dayLabel}: {step.title}
                      {step.help && (
                        <HelpHint
                          content={step.help}
                          className="text-on-primary/60 hover:text-secondary-fixed"
                        />
                      )}
                    </p>
                    <p className="text-body-md text-on-primary-container mb-3">
                      {step.description}
                    </p>
                    {step.extra}
                  </div>
                ) : (
                  <>
                    <p
                      className={`text-headline-sm mb-1 flex items-center gap-1.5 ${step.titleClass}`}
                    >
                      {step.dayLabel}: {step.title}
                      {step.help && (
                        <HelpHint
                          content={step.help}
                          className="text-on-primary/60 hover:text-secondary-fixed"
                        />
                      )}
                    </p>
                    <p className="text-body-md text-on-primary-container">
                      {step.description}
                    </p>
                    {step.extra}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 p-4 bg-on-primary/5 rounded-xl ghost-border">
          <div className="flex items-start gap-3">
            <Icon
              path={ICON_PATHS.shieldCheck}
              className="w-4 h-4 text-secondary-fixed shrink-0 mt-0.5"
            />
            <div>
              <p className="text-label-md text-on-primary-container/80 mb-1">
                {policyRecap(policy)}
              </p>
              <p className="text-body-md text-on-primary-container italic">
                Keeplas uses zero-knowledge encryption. Only an explicit reply
                from you — tap, email button, or WhatsApp — pauses the protocol.
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
