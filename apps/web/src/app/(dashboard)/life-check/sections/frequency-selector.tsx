"use client";

import { HelpHint, Icon } from "@keeplas/ui";
import { FREQUENCIES, type Frequency } from "./constants";

const CLOCK_ICON = "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z";

interface FrequencySelectorProps {
  value: Frequency;
  onChange: (value: Frequency) => void;
}

export function FrequencySelector({ value, onChange }: FrequencySelectorProps) {
  return (
    <section className="bg-surface-container-low rounded-2xl p-6 relative overflow-hidden">
      <h3 className="text-headline-sm text-primary mb-1.5 flex items-center gap-2">
        <Icon path={CLOCK_ICON} className="w-5 h-5 text-secondary" />
        Check-in cadence
        <HelpHint content="How often Keeplas asks you to confirm you're well. Shorter = more frequent check-ins; longer = fewer interruptions but slower release." />
      </h3>
      <p className="text-body-md text-on-surface-variant mb-6">
        How often Keeplas asks you to confirm you&apos;re well. Only an explicit
        reply — in-app tap, email button, or WhatsApp — resets the countdown;
        using the app does not.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {FREQUENCIES.map((freq) => {
          const selected = value === freq.value;
          return (
            <button
              key={freq.value}
              onClick={() => onChange(freq.value)}
              className={
                selected
                  ? "flex flex-col items-center justify-center p-5 bg-secondary text-on-secondary rounded-xl shadow-lg scale-[1.03] transition-transform cursor-pointer"
                  : "flex flex-col items-center justify-center p-5 bg-surface-container-highest rounded-xl hover:scale-[1.03] transition-transform cursor-pointer group"
              }
            >
              <span
                className={`text-headline-md font-black ${
                  selected ? "" : "text-primary group-hover:text-secondary"
                }`}
              >
                {freq.label}
              </span>
              <span
                className={`text-label-md mt-1 ${
                  selected ? "opacity-80" : "text-on-surface-variant"
                }`}
              >
                {freq.unit}
              </span>
              <span
                className={`text-label-md mt-1 ${
                  selected ? "opacity-60" : "text-on-surface-variant/60"
                }`}
              >
                {freq.description}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
