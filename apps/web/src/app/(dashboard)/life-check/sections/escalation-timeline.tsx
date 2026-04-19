"use client";

import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

interface TimelineStep {
  marker: React.ReactNode;
  title: string;
  titleClass: string;
  description: React.ReactNode;
  extra?: React.ReactNode;
}

const STEPS: TimelineStep[] = [
  {
    marker: (
      <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-secondary ring-4 ring-secondary/20 z-10" />
    ),
    title: "J+0: Verification Window Opens",
    titleClass: "text-on-primary",
    description:
      "A discreet notification is sent to your active devices. No one else is notified.",
  },
  {
    marker: (
      <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-secondary/50 z-10" />
    ),
    title: "J+7: Secondary Reach-out",
    titleClass: "text-on-primary/90",
    description:
      "Alternative channels (SMS/Recovery Email) are utilized. Frequency increases to daily.",
  },
  {
    marker: (
      <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-error/50 z-10" />
    ),
    title: "J+25: Critical Alert",
    titleClass: "text-error-container",
    description: (
      <span className="font-medium">
        Final countdown. This is the last chance to abort the automated protocol.
      </span>
    ),
  },
  {
    marker: (
      <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-error ring-4 ring-error/30 z-10" />
    ),
    title: "J+30: Protocol Triggered",
    titleClass: "text-on-primary text-headline-sm",
    description:
      "The Vault decrypts. Access keys are released to your Trusted Contacts automatically.",
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

export function EscalationTimeline() {
  return (
    <aside className="lg:col-span-5">
      <div className="vault-gradient rounded-2xl p-8 text-on-primary h-full shadow-2xl relative overflow-hidden">
        <h3 className="text-headline-md mb-1.5">
          Escalation Protocol
        </h3>
        <p className="text-body-md text-on-primary-container mb-10">
          Visual logic of the fail-safe trigger.
        </p>

        <div className="relative">
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-secondary/30" />

          <div className="space-y-8">
            {STEPS.map((step, idx) => {
              const isFinal = idx === STEPS.length - 1;
              return (
                <div key={step.title} className="relative pl-12">
                  {step.marker}
                  {isFinal ? (
                    <div className="bg-on-primary/5 p-4 rounded-xl backdrop-blur-sm">
                      <p className={`text-headline-sm mb-1.5 ${step.titleClass}`}>
                        {step.title}
                      </p>
                      <p className="text-body-md text-on-primary-container mb-3">
                        {step.description}
                      </p>
                      {step.extra}
                    </div>
                  ) : (
                    <>
                      <p className={`text-headline-sm mb-1 ${step.titleClass}`}>
                        {step.title}
                      </p>
                      <p className="text-body-md text-on-primary-container">
                        {step.description}
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 p-4 bg-on-primary/5 rounded-xl ghost-border">
          <div className="flex items-start gap-3">
            <Icon
              path={ICON_PATHS.shieldCheck}
              className="w-4 h-4 text-secondary-fixed shrink-0 mt-0.5"
            />
            <p className="text-body-md text-on-primary-container italic">
              Keeplas uses zero-knowledge encryption. Even our system administrators cannot abort a triggered protocol once the J+30 threshold is crossed without your master key.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
