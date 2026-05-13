"use client";

import { HelpHint, Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { FREQUENCIES, type ChannelConfig, type Frequency } from "./constants";

const PHASE_RATIOS = [0, 7 / 30, 25 / 30, 1] as const;

const TONE_STYLES = {
  active: "bg-secondary ring-4 ring-secondary/20",
  secondary: "bg-secondary/50",
  critical: "bg-error/50",
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

function dayLabel(thresholdDays: number, ratio: number): string {
  const exact = thresholdDays * ratio;
  if (exact === 0) return "D+0";
  if (exact < 1) {
    const hours = Math.round(exact * 24);
    return `D+${hours}h`;
  }
  const rounded = Math.round(exact);
  return `D+${rounded}`;
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

function buildSteps(
  channels: ChannelConfig[],
  frequency: Frequency,
): PhaseStep[] {
  const enabled = channels
    .filter((c) => c.isEnabled)
    .sort((a, b) => a.order - b.order);

  const days = frequencyDays(frequency);
  const total = enabled.length;

  const first = enabled[0];
  const last = total > 1 ? enabled[total - 1] : undefined;
  const middle = total > 2 ? enabled.slice(1, -1) : [];

  const openingDescription = first
    ? `${first.label} is dispatched. ${first.description}.`
    : "No channel enabled — the cycle cannot start.";

  const secondaryDescription =
    middle.length > 0
      ? `Alternative channels (${joinChannelLabels(middle)}) are utilized as the silence persists.`
      : total === 2
        ? "No intermediate channels enabled — Keeplas waits for the final attempt."
        : "No additional channels — the cycle proceeds straight to the final attempt.";

  const criticalDescription = last
    ? `Final attempt via ${last.label}. This is the last chance to abort the automated protocol.`
    : "Only one channel enabled — no critical pre-trigger reach-out.";

  return [
    {
      dayLabel: dayLabel(days, PHASE_RATIOS[0]),
      title: "Verification Window Opens",
      titleClass: "text-on-primary",
      description: openingDescription,
      tone: "active",
    },
    {
      dayLabel: dayLabel(days, PHASE_RATIOS[1]),
      title: "Secondary Reach-out",
      titleClass: "text-on-primary/90",
      description: secondaryDescription,
      tone: "secondary",
    },
    {
      dayLabel: dayLabel(days, PHASE_RATIOS[2]),
      title: "Critical Alert",
      titleClass: "text-error-container",
      description: <span className="font-medium">{criticalDescription}</span>,
      tone: "critical",
    },
    {
      dayLabel: dayLabel(days, PHASE_RATIOS[3]),
      title: "Protocol Triggered",
      titleClass: "text-on-primary text-headline-sm",
      description:
        "The Vault decrypts. Access keys are released to your Trusted Contacts automatically.",
      tone: "triggered",
      isFinal: true,
      extra: (
        <div className="flex gap-2 flex-wrap">
          <span className="px-3 py-1 bg-secondary text-on-secondary text-label-md rounded-full">
            Legal Legacy
          </span>
          <span className="px-3 py-1 bg-secondary text-on-secondary text-label-md rounded-full">
            Health Directives
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
  const steps = buildSteps(channels, frequency);
  const days = frequencyDays(frequency);

  return (
    <aside className="lg:col-span-5">
      <div className="vault-gradient rounded-2xl p-8 text-on-primary h-full shadow-2xl relative overflow-hidden">
        <h3 className="text-headline-md mb-1.5 flex items-center gap-2">
          Escalation Protocol
          <HelpHint
            content="The timeline scales to your Inactivity Threshold. From D+0, Keeplas tries each enabled Verification Channel in order — the first reaches you immediately, the last is the critical pre-trigger attempt. If every channel goes unanswered, the Vault decrypts at the threshold and access keys are released to your Trusted Contacts."
            className="text-on-primary/60 hover:text-secondary-fixed"
          />
        </h3>
        <p className="text-body-md text-on-primary-container mb-2">
          Visual logic of the fail-safe trigger.
        </p>
        <p className="text-label-md text-on-primary-container/80 mb-10">
          Scaled to your {days}-day inactivity threshold.
        </p>

        <div className="relative">
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-secondary/30" />

          <div className="space-y-8">
            {steps.map((step) => (
              <div key={step.title} className="relative pl-12">
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
              Keeplas uses zero-knowledge encryption. Even our system
              administrators cannot abort a triggered protocol once the final
              threshold is crossed without your master key.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
