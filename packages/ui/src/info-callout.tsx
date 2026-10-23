"use client";

import * as React from "react";
import { Icon } from "./icon";
import { cn } from "./lib/utils";

export type InfoCalloutTone = "info" | "warning" | "success" | "danger";

// v2 "Callout" (Figma / mobile): tinted surface, no border, semantic tokens.
const TONE_STYLES: Record<
  InfoCalloutTone,
  { container: string; icon: string }
> = {
  info: { container: "bg-bg-info", icon: "text-text-accent" },
  warning: { container: "bg-bg-pending", icon: "text-text-pending" },
  success: { container: "bg-status-active/10", icon: "text-status-active" },
  danger: { container: "bg-bg-danger", icon: "text-action-danger" },
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
        "flex items-start gap-[12px] rounded-[12px] px-[14px] py-[12px] text-text-primary",
        tones.container,
        className,
      )}
      {...props}
    >
      <Icon path={icon} className={cn("size-[22px] shrink-0", tones.icon)} />
      <div className="min-w-0 flex-1 text-body-sm [&>*+*]:mt-[4px]">
        {children}
      </div>
    </div>
  );
}
