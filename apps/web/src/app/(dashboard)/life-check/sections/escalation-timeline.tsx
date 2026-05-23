"use client";

import { HelpHint, Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { FREQUENCIES, type ChannelConfig, type Frequency } from "./constants";

// Mirrors CHECK_IN_WINDOW_DAYS / REMINDER_FRACTIONS in
// packages/convex/life_check.ts. Keep in sync.
const CHECK_IN_WINDOW_DAYS = 7;
const REMINDER_DAYS = [3, 6] as const;

const TONE_STYLES = {
  active: "bg-secondary ring-4 ring-secondary/20",
  reminder: "bg-secondary/50",
  triggered: "bg-error ring-4 ring-error/30",
} as const;

type Tone = keyof typeof TONE_STYLES;

interface EscalationTimelineProps {
  channels: ChannelConfig[];
  frequency: Frequency;
}

interface PhaseStep {
  dayLabel: string;
  title: string;
  titleClass: string;
  description: React.ReactNode;
  tone: Tone;
  isFinal?: boolean;
  extra?: React.ReactNode;
}

function frequencyDays(frequency: Frequency): number {
  return Number(FREQUENCIES.find((f) => f.value === frequency)?.label ?? 30);
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

function buildSteps(channels: ChannelConfig[]): PhaseStep[] {
  const enabled = channels.filter((c) => c.isEnabled);

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
        "No confirmation across the whole window — Keeplas begins releasing your vault to your trusted contacts.",
      tone: "triggered",
      isFinal: true,
      extra: (
        <div className="flex gap-2 flex-wrap">
          <span className="px-3 py-1 bg-secondary text-on-secondary text-label-md rounded-full">
            Trusted contacts notified
          </span>
        </div>
      ),
    },
  ];
}

export function EscalationTimeline({
  channels,
  frequency,
}: EscalationTimelineProps) {
  const steps = buildSteps(channels);
  const days = frequencyDays(frequency);

  return (
    <aside className="lg:col-span-5">
      <div className="vault-gradient rounded-2xl p-8 text-on-primary h-full shadow-2xl relative overflow-hidden">
        <h3 className="text-headline-md mb-1.5 flex items-center gap-2">
          Escalation Protocol
          <HelpHint
            content="Every cadence period Keeplas asks you to confirm you're well. You then have a 7-day window with reminders to reply — by tapping in the app, clicking the email button, or replying on WhatsApp. Only an explicit reply resets the countdown; using the app does not. If the whole window passes in silence, Keeplas begins releasing your vault to your trusted contacts."
            className="text-on-primary/60 hover:text-secondary-fixed"
          />
        </h3>
        <p className="text-body-md text-on-primary-container mb-2">
          What happens after a missed check-in.
        </p>
        <p className="text-label-md text-on-primary-container/80 mb-10">
          Keeplas asks you to confirm every {days} days.
        </p>

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
                    <p className={`text-headline-sm mb-1.5 ${step.titleClass}`}>
                      {step.dayLabel}: {step.title}
                    </p>
                    <p className="text-body-md text-on-primary-container mb-3">
                      {step.description}
                    </p>
                    {step.extra}
                  </div>
                ) : (
                  <>
                    <p className={`text-headline-sm mb-1 ${step.titleClass}`}>
                      {step.dayLabel}: {step.title}
                    </p>
                    <p className="text-body-md text-on-primary-container">
                      {step.description}
                    </p>
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
            <p className="text-body-md text-on-primary-container italic">
              Keeplas uses zero-knowledge encryption. Only an explicit reply from
              you — tap, email button, or WhatsApp — pauses the protocol.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
