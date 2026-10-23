import { cn, HelpHint, InfoCallout } from "@keeplas/ui";
import { Panel } from "@/components/v2/surface";
import { formatDate } from "@/lib/format";
import { useLocale, useTranslations } from "@/lib/i18n";
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
  active: "bg-action-primary ring-4 ring-progress-track",
  reminder: "bg-border-strong",
  confirm: "bg-status-pending",
  triggered: "bg-action-danger ring-4 ring-bg-danger",
} as const;

type Tone = keyof typeof TONE_STYLES;

interface ReleasePolicy {
  confirmationThreshold: number;
  confirmationWindowDays: number;
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
  description: React.ReactNode;
  tone: Tone;
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
  const { confirmationThreshold, confirmationWindowDays } = policy;

  return [
    {
      dayLabel: "D+0",
      title: t("timeline.steps.sent.title"),
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
      description: t("timeline.steps.reminder.description"),
      tone: "reminder" as Tone,
    })),
    {
      dayLabel: `D+${CHECK_IN_WINDOW_DAYS}`,
      title: t("timeline.steps.protocolBegins.title"),
      description: t("timeline.steps.protocolBegins.description"),
      tone: "confirm",
      help: t("timeline.steps.protocolBegins.help"),
      extra: (
        <span className="mt-[8px] inline-flex rounded-full bg-bg-pending px-[10px] py-[4px] text-caption text-text-pending">
          {t("timeline.steps.protocolBegins.badge")}
        </span>
      ),
    },
    {
      dayLabel: t("timeline.steps.contactsConfirm.dayLabel"),
      title: t("timeline.steps.contactsConfirm.title"),
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
      description: t("timeline.steps.lastChance.description", {
        hours: GRACE_HOURS,
      }),
      tone: "confirm",
      help: t("timeline.steps.lastChance.help", { hours: GRACE_HOURS }),
    },
    {
      dayLabel: t("timeline.steps.released.dayLabel"),
      title: t("timeline.steps.released.title"),
      description: t("timeline.steps.released.description", {
        contacts: trustedContactsLabel(confirmationThreshold, t),
      }),
      tone: "triggered",
      help: t("timeline.steps.released.help"),
    },
  ];
}

function policyRecap(
  { confirmationThreshold, confirmationWindowDays }: ReleasePolicy,
  t: Translator,
): string {
  return t("timeline.recap.text", {
    contacts: contactsLabel(confirmationThreshold, t),
    days: confirmationWindowDays,
  });
}

export function EscalationTimeline({
  channels,
  frequency,
  confirmationThreshold,
  confirmationWindowDays,
  travelModeEnabled,
  travelModeUntil,
}: EscalationTimelineProps) {
  const t = useTranslations("lifeCheck");
  const locale = useLocale();
  const policy: ReleasePolicy = {
    confirmationThreshold,
    confirmationWindowDays,
  };
  const steps = buildSteps(channels, policy, t);
  const cadence = cadenceLabel(frequency, t);

  return (
    <Panel className="flex flex-col gap-[20px] p-[20px]">
      <div className="flex flex-col gap-[4px]">
        <h2 className="flex items-center gap-[8px] text-h3 text-text-primary">
          {t("timeline.title")}
          <HelpHint content={t("timeline.help")} />
        </h2>
        <p className="text-body-sm text-text-muted">{t("timeline.subtitle")}</p>
        <p className="text-caption text-text-muted">
          {t("timeline.cadence", { cadence })}
        </p>
      </div>

      {travelModeEnabled && (
        <InfoCallout icon={ICON_PATHS.globe}>
          {travelModeUntil
            ? t("timeline.travelPausedUntil", {
                date: formatDate(travelModeUntil, locale),
              })
            : t("timeline.travelPaused")}
        </InfoCallout>
      )}

      <ol className="relative flex flex-col gap-[20px]">
        <span
          aria-hidden
          className="absolute bottom-[8px] left-[7px] top-[8px] w-px bg-border-default"
        />
        {steps.map((step) => (
          <li key={step.dayLabel} className="relative pl-[32px]">
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-[3px] size-[15px] rounded-full",
                TONE_STYLES[step.tone],
              )}
            />
            <p className="text-label text-text-primary">
              <span className="mr-[6px] text-text-muted">{step.dayLabel}</span>
              {step.title}
              {step.help && (
                <HelpHint content={step.help} className="ml-[6px]" />
              )}
            </p>
            <p className="text-body-sm text-text-muted">{step.description}</p>
            {step.extra}
          </li>
        ))}
      </ol>

      <InfoCallout icon={ICON_PATHS.shieldCheck}>
        <p className="text-label">{policyRecap(policy, t)}</p>
        <p className="text-text-muted">{t("timeline.footer")}</p>
      </InfoCallout>
    </Panel>
  );
}
