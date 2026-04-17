"use client";

import * as React from "react";
import { cn } from "./lib/utils";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const jsDay = first.getDay();
  const mondayOffset = (jsDay + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    );
  }
  return cells;
}

export interface CalendarProps {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  min?: Date;
  max?: Date;
  className?: string;
  showFooter?: boolean;
}

export const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  (
    { value, onChange, min, max, className, showFooter = true },
    ref
  ) => {
    const today = React.useMemo(() => startOfDay(new Date()), []);
    const [viewDate, setViewDate] = React.useState<Date>(() =>
      value ? new Date(value.getFullYear(), value.getMonth(), 1) : today
    );

    React.useEffect(() => {
      if (value) {
        setViewDate(new Date(value.getFullYear(), value.getMonth(), 1));
      }
    }, [value]);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const cells = buildMonthGrid(year, month);

    function isDisabled(d: Date): boolean {
      if (min && startOfDay(d).getTime() < startOfDay(min).getTime())
        return true;
      if (max && startOfDay(d).getTime() > startOfDay(max).getTime())
        return true;
      return false;
    }

    function goPrevMonth() {
      setViewDate(new Date(year, month - 1, 1));
    }

    function goNextMonth() {
      setViewDate(new Date(year, month + 1, 1));
    }

    return (
      <div
        ref={ref}
        className={cn(
          "bg-surface-container-lowest rounded-2xl shadow-xl p-5 w-[312px] font-body border border-outline-variant/20",
          className
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="font-headline font-extrabold text-primary text-sm tracking-tight">
            {MONTHS[month]} {year}
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={goPrevMonth}
              aria-label="Previous month"
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5 8.25 12l7.5-7.5"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={goNextMonth}
              aria-label="Next month"
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m8.25 4.5 7.5 7.5-7.5 7.5"
                />
              </svg>
            </button>
          </div>
        </div>

        <div
          className="grid grid-cols-7 gap-1 mb-1"
          role="row"
          aria-hidden="true"
        >
          {WEEKDAYS.map((wd, i) => (
            <div
              key={i}
              className="text-center font-headline text-[10px] uppercase tracking-widest font-bold text-on-surface-variant py-1.5"
            >
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1" role="grid">
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === month;
            const isSelected = value ? sameDay(d, value) : false;
            const isToday = sameDay(d, today);
            const disabled = isDisabled(d);

            return (
              <button
                key={i}
                type="button"
                role="gridcell"
                aria-selected={isSelected}
                aria-disabled={disabled}
                disabled={disabled}
                onClick={() => onChange?.(d)}
                className={cn(
                  "aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary",
                  !inMonth && "text-outline-variant/70",
                  inMonth &&
                    !isSelected &&
                    !disabled &&
                    "text-on-surface hover:bg-surface-container-high",
                  isSelected &&
                    "bg-secondary text-on-secondary font-bold shadow-sm",
                  !isSelected &&
                    isToday &&
                    inMonth &&
                    "ring-1 ring-secondary/50 text-secondary font-bold",
                  disabled && "opacity-30 cursor-not-allowed"
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>

        {showFooter && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={() => onChange?.(null)}
              className="text-[11px] font-headline font-bold uppercase tracking-widest text-on-surface-variant hover:text-error focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary rounded-md px-1 py-0.5 transition-colors cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
                onChange?.(today);
              }}
              className="text-[11px] font-headline font-bold uppercase tracking-widest text-secondary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary rounded-md px-1 py-0.5 transition-colors cursor-pointer"
            >
              Today
            </button>
          </div>
        )}
      </div>
    );
  }
);
Calendar.displayName = "Calendar";
