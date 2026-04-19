"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { Calendar } from "./calendar";
import { cn } from "./lib/utils";

function parseISO(s?: string | null): Date | undefined {
  if (!s) return undefined;
  const parts = s.split("-").map(Number);
  if (parts.length !== 3) return undefined;
  const [y, m, d] = parts;
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplay(d: Date, locale?: string): string {
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export interface DatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  locale?: string;
  align?: "start" | "center" | "end";
}

export const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      min,
      max,
      placeholder = "Select a date",
      id,
      disabled,
      className,
      locale,
      align = "start",
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const selectedDate = parseISO(value);

    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          ref={ref}
          id={id}
          disabled={disabled}
          className={cn(
            "w-full flex items-center justify-between gap-3 px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm text-left transition-colors font-body",
            "hover:border-outline focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40",
            "disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer",
            selectedDate ? "text-on-surface" : "text-on-surface-variant",
            className
          )}
        >
          <span className="truncate">
            {selectedDate ? formatDisplay(selectedDate, locale) : placeholder}
          </span>
          <svg
            className="w-4 h-4 text-on-surface-variant shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
            />
          </svg>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={8} align={align}>
            <Popover.Popup
              className={cn(
                "outline-none z-50",
                "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
                "data-[starting-style]:scale-95 data-[ending-style]:scale-95",
                "transition-[opacity,transform] duration-150 origin-top"
              )}
            >
              <Calendar
                value={selectedDate}
                min={parseISO(min)}
                max={parseISO(max)}
                onChange={(d) => {
                  onChange?.(d ? toISO(d) : "");
                  if (d) setOpen(false);
                }}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    );
  }
);
DatePicker.displayName = "DatePicker";
