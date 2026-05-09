"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Icon } from "./icon";
import { cn } from "./lib/utils";

const HELP_ICON_PATH =
  "M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z";

export interface HelpHintProps {
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  iconClassName?: string;
  size?: "sm" | "md";
  label?: string;
}

/**
 * Click-triggered help icon. Uses Popover (not Tooltip) so the hint opens on
 * tap on touch devices where hover doesn't exist.
 */
export function HelpHint({
  content,
  side = "top",
  className,
  iconClassName,
  size = "sm",
  label = "More information",
}: HelpHintProps) {
  const dimension = size === "sm" ? "w-5 h-5" : "w-6 h-6";

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative inline-flex items-center justify-center text-outline-variant hover:text-secondary transition-colors cursor-pointer align-middle bg-transparent p-0 border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 rounded-full",
          // Touch target ≥44px without affecting inline layout
          "before:content-[''] before:absolute before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-11 before:h-11 before:rounded-full",
          className,
        )}
      >
        <Icon path={HELP_ICON_PATH} className={cn(dimension, iconClassName)} />
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="center"
        sideOffset={6}
        className="max-w-xs p-3 text-xs leading-relaxed bg-surface text-on-surface shadow-lg border border-outline-variant/40"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
