"use client";

import { HelpHint, Icon } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";
import { ICON_PATHS } from "@/lib/icons";
import { FREQUENCIES, type ChannelConfig, type Frequency } from "./constants";

type Translator = (
  key: string,
  params?: Record<string, string | number>,
) => string;

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

function cadenceLabel(frequency: Frequency, t: Translator): string {
  const freq = FREQUENCIES.find((f) => f.value === frequency);
  if (!freq) return t("timeline.cadenceFallback");
  return `${freq.label} ${t(`frequency.unit.${freq.value}`).toLowerCase()}`;
}

function joinChannelLabels(channels: ChannelConfig[], t: Translator): string {
  const labels = channels.map((c) => t(`channels.items.${c.type}.label`));
  if (labels.length === 0) return t("timeline.noChannelInline");
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  const head = labels.slice(0, -1).join(", ");
  return `${head} & ${labels[labels.length - 1]}`;
}

function contactsLabel(n: number, t: Translator): string {
  return t(n > 1 ? "timeline.contactsPlural" : "timeline.contactsSingular", {
    count: n,
  });
}

function trustedContactsLabel(n: number, t: Translator): string {
  return t(
    n > 1
      ? "timeline.trustedContactsPlural"
      : "timeline.trustedContactsSingular",
    { count: n },
  );
}

function buildSteps(
  channels: ChannelConfig[],
  policy: ReleasePolicy,
  t: Translator,
): PhaseStep[] {
  // Only channels that are enabled AND verified actually go out — an
  // unverified email/phone can't be reached, so keep it out of the timeline.
  const enabled = channels.filter((c) => c.isEnabled && c.isVerified !== false);
  const { confirmationThreshold, confirmationWindowDays, fallbackBehavior } =
    policy;

  return [
    {
      dayLabel: "D+0",
      title: t("timeline.steps.sent.title"),
      titleClass: "text-on-primary",
      description: enabled.length
        ? t("timeline.steps.sent.description", {
            channels: joinChannelLabels(enabled, t),
          })
        : t("timeline.steps.sent.descriptionNoChannel"),
      tone: "active",
    },
    ...REMINDER_DAYS.map((day, i) => ({
      dayLabel: `D+${day}`,
      title:
        i === REMINDER_DAYS.length - 1
          ? t("timeline.steps.reminder.titleFinal")
          : t("timeline.steps.reminder.title"),
      titleClass: "text-on-primary/90",
      description: t("timeline.steps.reminder.description"),
      tone: "reminder" as Tone,
    })),
    {
      dayLabel: `D+${CHECK_IN_WINDOW_DAYS}`,
      title: t("timeline.steps.protocolBegins.title"),
      titleClass: "text-on-primary text-headline-sm",
      description: t("timeline.steps.protocolBegins.description"),
      tone: "confirm",
      help: t("timeline.steps.protocolBegins.help"),
      extra: (
        <div className="flex gap-2 flex-wrap mt-3">
          <span className="px-3 py-1 bg-secondary text-on-secondary text-label-md rounded-full">
            {t("timeline.steps.protocolBegins.badge")}
          </span>
        </div>
      ),
    },
    {
      dayLabel: t("timeline.steps.contactsConfirm.dayLabel"),
      title: t("timeline.steps.contactsConfirm.title"),
      titleClass: "text-on-primary/90",
      description: t("timeline.steps.contactsConfirm.description", {
        contacts: trustedContactsLabel(confirmationThreshold, t),
        days: confirmationWindowDays,
      }),
      tone: "confirm",
      help: t("timeline.steps.contactsConfirm.help", {
        threshold: confirmationThreshold,
        days: confirmationWindowDays,
      }),
    },
    {
      dayLabel: `+${GRACE_HOURS}h`,
      title: t("timeline.steps.lastChance.title"),
      titleClass: "text-on-primary/90",
      description: t("timeline.steps.lastChance.description", {
        hours: GRACE_HOURS,
      }),
      tone: "confirm",
      help: t("timeline.steps.lastChance.help", { hours: GRACE_HOURS }),
    },
    {
      dayLabel: t("timeline.steps.released.dayLabel"),
      title: t("timeline.steps.released.title"),
      titleClass: "text-on-primary text-headline-sm",
      description:
        fallbackBehavior === "release_anyway"
          ? t("timeline.steps.released.descriptionAnyway", {
              contacts: trustedContactsLabel(confirmationThreshold, t),
            })
          : t("timeline.steps.released.descriptionAbort", {
              contacts: trustedContactsLabel(confirmationThreshold, t),
            }),
      tone: "triggered",
      isFinal: true,
      help: t("timeline.steps.released.help"),
    },
  ];
}

function policyRecap(
  {
    confirmationThreshold,
    confirmationWindowDays,
    fallbackBehavior,
  }: ReleasePolicy,
  t: Translator,
): string {
  const fallback =
    fallbackBehavior === "release_anyway"
      ? t("timeline.recap.fallbackAnyway")
      : t("timeline.recap.fallbackAbort");
  return t("timeline.recap.text", {
    contacts: contactsLabel(confirmationThreshold, t),
    days: confirmationWindowDays,
    fallback,
  });
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
  const t = useTranslations("lifeCheck");
  const policy: ReleasePolicy = {
    confirmationThreshold,
    confirmationWindowDays,
    fallbackBehavior,
  };
  const steps = buildSteps(channels, policy, t);
  const cadence = cadenceLabel(frequency, t);

  return (
    <aside className="lg:col-span-5">
      <div className="vault-gradient rounded-2xl p-8 text-on-primary h-full shadow-2xl relative overflow-hidden">
        <h3 className="text-headline-md mb-1.5 flex items-center gap-2">
          {t("timeline.title")}
          <HelpHint
            content={t("timeline.help")}
            className="text-on-primary/60 hover:text-secondary-fixed"
          />
        </h3>
        <p className="text-body-md text-on-primary-container mb-2">
          {t("timeline.subtitle")}
        </p>
        <p className="text-label-md text-on-primary-container/80 mb-8">
          {t("timeline.cadence", { cadence })}
        </p>

        {travelModeEnabled && (
          <div className="mb-8 p-4 bg-on-primary/5 rounded-xl ghost-border flex items-start gap-3">
            <Icon
              path={ICON_PATHS.globe}
              className="w-4 h-4 text-secondary-fixed shrink-0 mt-0.5"
            />
            <p className="text-body-md text-on-primary-container">
              {travelModeUntil
                ? t("timeline.travelPausedUntil", {
                    date: new Date(travelModeUntil).toLocaleDateString(),
                  })
                : t("timeline.travelPaused")}
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
                {policyRecap(policy, t)}
              </p>
              <p className="text-body-md text-on-primary-container italic">
                {t("timeline.footer")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
