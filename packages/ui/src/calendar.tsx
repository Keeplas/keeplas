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
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const YEAR_PAGE_SIZE = 12;

type View = "days" | "months" | "years";

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

function yearPageStart(year: number): number {
  return Math.floor(year / YEAR_PAGE_SIZE) * YEAR_PAGE_SIZE;
}

function clampYear(year: number, min?: Date, max?: Date): number {
  let y = year;
  if (min && y < min.getFullYear()) y = min.getFullYear();
  if (max && y > max.getFullYear()) y = max.getFullYear();
  return y;
}

function clampMonth(
  year: number,
  month: number,
  min?: Date,
  max?: Date
): number {
  let m = month;
  if (min && year === min.getFullYear() && m < min.getMonth()) m = min.getMonth();
  if (max && year === max.getFullYear() && m > max.getMonth()) m = max.getMonth();
  return m;
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
  ({ value, onChange, min, max, className, showFooter = true }, ref) => {
    const today = React.useMemo(() => startOfDay(new Date()), []);
    const [viewDate, setViewDate] = React.useState<Date>(() =>
      value ? new Date(value.getFullYear(), value.getMonth(), 1) : today
    );
    const [view, setView] = React.useState<View>("days");

    React.useEffect(() => {
      if (value) {
        setViewDate(new Date(value.getFullYear(), value.getMonth(), 1));
      }
    }, [value]);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    function isDayDisabled(d: Date): boolean {
      if (min && startOfDay(d).getTime() < startOfDay(min).getTime())
        return true;
      if (max && startOfDay(d).getTime() > startOfDay(max).getTime())
        return true;
      return false;
    }

    function isMonthDisabled(y: number, m: number): boolean {
      const lastOfMonth = new Date(y, m + 1, 0);
      const firstOfMonth = new Date(y, m, 1);
      if (max && firstOfMonth.getTime() > startOfDay(max).getTime()) return true;
      if (min && lastOfMonth.getTime() < startOfDay(min).getTime()) return true;
      return false;
    }

    function isYearDisabled(y: number): boolean {
      if (min && y < min.getFullYear()) return true;
      if (max && y > max.getFullYear()) return true;
      return false;
    }

    function goPrev() {
      if (view === "days") {
        setViewDate(new Date(year, month - 1, 1));
      } else if (view === "months") {
        setViewDate(new Date(year - 1, month, 1));
      } else {
        setViewDate(new Date(year - YEAR_PAGE_SIZE, month, 1));
      }
    }

    function goNext() {
      if (view === "days") {
        setViewDate(new Date(year, month + 1, 1));
      } else if (view === "months") {
        setViewDate(new Date(year + 1, month, 1));
      } else {
        setViewDate(new Date(year + YEAR_PAGE_SIZE, month, 1));
      }
    }

    function onHeaderClick() {
      if (view === "days") setView("months");
      else if (view === "months") setView("years");
      else setView("days");
    }

    function selectYear(y: number) {
      const safeYear = clampYear(y, min, max);
      const safeMonth = clampMonth(safeYear, month, min, max);
      setViewDate(new Date(safeYear, safeMonth, 1));
      setView("months");
    }

    function selectMonth(m: number) {
      setViewDate(new Date(year, m, 1));
      setView("days");
    }

    const prevDisabled = (() => {
      if (!min) return false;
      if (view === "days") {
        return new Date(year, month, 0).getTime() < startOfDay(min).getTime();
      }
      if (view === "months") {
        return year - 1 < min.getFullYear();
      }
      return year - YEAR_PAGE_SIZE < min.getFullYear();
    })();

    const nextDisabled = (() => {
      if (!max) return false;
      if (view === "days") {
        return new Date(year, month + 1, 1).getTime() > startOfDay(max).getTime();
      }
      if (view === "months") {
        return year + 1 > max.getFullYear();
      }
      return year + YEAR_PAGE_SIZE > max.getFullYear();
    })();

    const headerLabel =
      view === "days"
        ? `${MONTHS[month]} ${year}`
        : view === "months"
          ? `${year}`
          : (() => {
              const start = yearPageStart(year);
              return `${start} – ${start + YEAR_PAGE_SIZE - 1}`;
            })();

    const headerAriaLabel =
      view === "days"
        ? "Switch to month view"
        : view === "months"
          ? "Switch to year view"
          : "Switch to day view";

    return (
      <div
        ref={ref}
        className={cn(
          "bg-surface-container-lowest rounded-2xl shadow-xl p-5 w-[312px] font-body border border-outline-variant/20",
          className
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={onHeaderClick}
            aria-label={headerAriaLabel}
            className="font-headline font-extrabold text-primary text-sm tracking-tight px-2 py-1 -mx-2 rounded-lg hover:bg-surface-container-high focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors cursor-pointer"
          >
            {headerLabel}
          </button>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={goPrev}
              disabled={prevDisabled}
              aria-label="Previous"
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
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
              onClick={goNext}
              disabled={nextDisabled}
              aria-label="Next"
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
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

        {view === "days" && (
          <>
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
              {buildMonthGrid(year, month).map((d, i) => {
                const inMonth = d.getMonth() === month;
                const isSelected = value ? sameDay(d, value) : false;
                const isToday = sameDay(d, today);
                const disabled = isDayDisabled(d);

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
          </>
        )}

        {view === "months" && (
          <div className="grid grid-cols-3 gap-2" role="grid">
            {MONTHS_SHORT.map((label, m) => {
              const isSelected =
                value !== null &&
                value !== undefined &&
                value.getFullYear() === year &&
                value.getMonth() === m;
              const isCurrent =
                today.getFullYear() === year && today.getMonth() === m;
              const disabled = isMonthDisabled(year, m);

              return (
                <button
                  key={m}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-disabled={disabled}
                  disabled={disabled}
                  onClick={() => selectMonth(m)}
                  className={cn(
                    "py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary",
                    !isSelected &&
                      !disabled &&
                      "text-on-surface hover:bg-surface-container-high",
                    isSelected &&
                      "bg-secondary text-on-secondary font-bold shadow-sm",
                    !isSelected &&
                      isCurrent &&
                      "ring-1 ring-secondary/50 text-secondary font-bold",
                    disabled && "opacity-30 cursor-not-allowed"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {view === "years" && (
          <div className="grid grid-cols-3 gap-2" role="grid">
            {(() => {
              const start = yearPageStart(year);
              const years: number[] = [];
              for (let i = 0; i < YEAR_PAGE_SIZE; i++) years.push(start + i);
              return years.map((y) => {
                const isSelected =
                  value !== null &&
                  value !== undefined &&
                  value.getFullYear() === y;
                const isCurrent = today.getFullYear() === y;
                const disabled = isYearDisabled(y);

                return (
                  <button
                    key={y}
                    type="button"
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-disabled={disabled}
                    disabled={disabled}
                    onClick={() => selectYear(y)}
                    className={cn(
                      "py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary",
                      !isSelected &&
                        !disabled &&
                        "text-on-surface hover:bg-surface-container-high",
                      isSelected &&
                        "bg-secondary text-on-secondary font-bold shadow-sm",
                      !isSelected &&
                        isCurrent &&
                        "ring-1 ring-secondary/50 text-secondary font-bold",
                      disabled && "opacity-30 cursor-not-allowed"
                    )}
                  >
                    {y}
                  </button>
                );
              });
            })()}
          </div>
        )}

        {showFooter && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={() => {
                setView("days");
                onChange?.(null);
              }}
              className="text-[11px] font-headline font-bold uppercase tracking-widest text-on-surface-variant hover:text-error focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary rounded-md px-1 py-0.5 transition-colors cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
                setView("days");
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
