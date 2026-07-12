"use client";

import * as React from "react";
import { Icon } from "./icon";
import { cn } from "./lib/utils";

export type InfoCalloutTone = "info" | "warning" | "success";

const TONE_STYLES: Record<
  InfoCalloutTone,
  { container: string; icon: string }
> = {
  info: {
    container:
      "bg-surface-container-low border-outline-variant/40 text-on-surface-variant",
    icon: "text-secondary",
  },
  warning: {
    container:
      "bg-secondary-fixed/15 border-secondary-fixed/40 text-on-surface",
    icon: "text-secondary",
  },
  success: {
    container: "bg-secondary/10 border-secondary/30 text-on-surface",
    icon: "text-secondary",
  },
};

export interface InfoCalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Heroicons-style SVG path data passed to the inline icon. */
  icon: string;
  tone?: InfoCalloutTone;
  /** Inline body — keep it short, plain text or a couple of links. */
  children: React.ReactNode;
}

/**
 * Compact contextual note paired with an icon. Use this whenever a field or
 * card needs an inline explanation that's visible by default (vs `HelpHint`
 * which only reveals on hover).
 */
export function InfoCallout({
  icon,
  tone = "info",
  className,
  children,
  ...props
}: InfoCalloutProps) {
  const tones = TONE_STYLES[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-xl border",
        tones.container,
        className,
      )}
      {...props}
    >
      <Icon path={icon} className={cn("w-4 h-4 mt-0.5 shrink-0", tones.icon)} />
      <div className="text-body-md leading-relaxed">{children}</div>
    </div>
  );
}
