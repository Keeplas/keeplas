import { useState, type ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  Icon,
  cn,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

export interface MultiSelectOption {
  value: string;
  label: string;
  hint?: string;
  groupLabel?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  triggerClassName?: string;
  renderTrigger?: (
    selected: string[],
    options: MultiSelectOption[],
  ) => ReactNode;
  disabled?: boolean;
  /**
   * Optional action rendered at the bottom of the popover (e.g. "Add new…").
   * Receives a `close` callback so the action can dismiss the popover before
   * triggering, for example, a nested dialog.
   */
  footer?: (close: () => void) => ReactNode;
}

function groupOptions(options: MultiSelectOption[]) {
  const map = new Map<string, MultiSelectOption[]>();
  for (const opt of options) {
    const key = opt.groupLabel ?? "";
    const list = map.get(key) ?? [];
    list.push(opt);
    map.set(key, list);
  }
  return Array.from(map.entries());
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  emptyMessage,
  searchPlaceholder,
  triggerClassName,
  renderTrigger,
  disabled,
  footer,
}: MultiSelectProps) {
  const t = useTranslations("trustedContacts");
  const [open, setOpen] = useState(false);

  const resolvedPlaceholder = placeholder ?? t("multiSelect.placeholder");
  const resolvedEmptyMessage = emptyMessage ?? t("multiSelect.emptyMessage");
  const resolvedSearchPlaceholder =
    searchPlaceholder ?? t("multiSelect.searchPlaceholder");

  const selectedSet = new Set(selected);

  function toggle(value: string) {
    if (selectedSet.has(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  const groups = groupOptions(options);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between gap-3 bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-sm text-left text-on-surface font-body transition-colors",
          "hover:border-outline focus:bg-surface-container-high focus:border-secondary/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40",
          "data-[state=open]:bg-surface-container-high",
          "disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer",
          triggerClassName,
        )}
      >
        <div className="flex-1 min-w-0">
          {renderTrigger ? (
            renderTrigger(selected, options)
          ) : selected.length === 0 ? (
            <span className="text-outline-variant">{resolvedPlaceholder}</span>
          ) : (
            <span className="truncate">
              {t("multiSelect.selectedCount", { count: selected.length })}
            </span>
          )}
        </div>
        <Icon
          path={ICON_PATHS.chevronRight}
          className="w-4 h-4 rotate-90 text-on-surface-variant shrink-0"
          strokeWidth={1.75}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0 overflow-hidden"
      >
        <Command className="rounded-2xl">
          <CommandInput placeholder={resolvedSearchPlaceholder} />
          <CommandList>
            <CommandEmpty>{resolvedEmptyMessage}</CommandEmpty>
            {groups.map(([groupLabel, items]) => (
              <CommandGroup
                key={groupLabel || "_root"}
                heading={groupLabel || undefined}
              >
                {items.map((opt) => {
                  const isSelected = selectedSet.has(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      value={`${opt.label} ${opt.hint ?? ""}`}
                      onSelect={() => toggle(opt.value)}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                          isSelected
                            ? "bg-secondary border-secondary text-on-secondary"
                            : "border-outline-variant",
                        )}
                      >
                        {isSelected && (
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                            aria-hidden
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m4.5 12.75 6 6 9-13.5"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{opt.label}</span>
                        {opt.hint && (
                          <span className="text-label-md text-on-surface-variant truncate">
                            {opt.hint}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
          {footer && (
            <div className="border-t border-outline-variant/20 p-1.5">
              {footer(() => setOpen(false))}
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
