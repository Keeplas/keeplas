"use client";

import * as React from "react";
import { cn } from "./lib/utils";

// The password policy, defined once. The same five rules are enforced
// server-side in `packages/convex/lib/password.ts` (the real gate); this copy
// powers the live strength meter. Special char = any non-alphanumeric.
const RULES: { key: PasswordRuleKey; test: (pw: string) => boolean }[] = [
  { key: "length", test: (pw) => pw.length >= 8 },
  { key: "uppercase", test: (pw) => /[A-Z]/.test(pw) },
  { key: "lowercase", test: (pw) => /[a-z]/.test(pw) },
  { key: "number", test: (pw) => /[0-9]/.test(pw) },
  { key: "special", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export type PasswordRuleKey =
  | "length"
  | "uppercase"
  | "lowercase"
  | "number"
  | "special";

export interface PasswordEvaluation {
  results: { key: PasswordRuleKey; met: boolean }[];
  metCount: number;
  /** All rules satisfied — the gate for accepting a password. */
  isStrong: boolean;
}

export function evaluatePassword(password: string): PasswordEvaluation {
  const results = RULES.map((r) => ({ key: r.key, met: r.test(password) }));
  const metCount = results.filter((r) => r.met).length;
  return { results, metCount, isStrong: metCount === RULES.length };
}

type Tier = "weak" | "medium" | "strong";

function tierFor(metCount: number): Tier {
  if (metCount <= 2) return "weak";
  if (metCount <= 4) return "medium";
  return "strong";
}

const TIER_STYLES: Record<Tier, { text: string; bar: string }> = {
  weak: { text: "text-error", bar: "bg-error" },
  medium: { text: "text-secondary", bar: "bg-secondary-container" },
  strong: { text: "text-secondary", bar: "bg-secondary" },
};

export interface PasswordStrengthLabels {
  weak: string;
  medium: string;
  strong: string;
  rules: Record<PasswordRuleKey, string>;
}

export interface PasswordStrengthProps {
  password: string;
  labels: PasswordStrengthLabels;
  className?: string;
}

/**
 * Live password-strength meter + requirement checklist. Presentational only —
 * the consumer passes translated `labels` and gates submission on
 * `evaluatePassword(password).isStrong`.
 */
export function PasswordStrength({
  password,
  labels,
  className,
}: PasswordStrengthProps) {
  const { results, metCount } = evaluatePassword(password);
  const tier = tierFor(metCount);
  const style = TIER_STYLES[tier];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <AlertCircleIcon className={cn("w-4 h-4 shrink-0", style.text)} />
        <span className={cn("text-label-lg font-medium", style.text)}>
          {labels[tier]}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
        <div
          className={cn("h-full rounded-full transition-all", style.bar)}
          style={{ width: `${(metCount / RULES.length) * 100}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {results.map(({ key, met }) => (
          <li key={key} className="flex items-center gap-2">
            {met ? (
              <CheckIcon className="w-4 h-4 shrink-0 text-secondary" />
            ) : (
              <CloseIcon className="w-4 h-4 shrink-0 text-on-surface-variant/50" />
            )}
            <span
              className={cn(
                "text-body-sm",
                met
                  ? "font-medium text-on-surface"
                  : "text-on-surface-variant/70",
              )}
            >
              {labels.rules[key]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m0 3.75h.008v.008H12V16.5Zm9-4.5a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.25}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}
