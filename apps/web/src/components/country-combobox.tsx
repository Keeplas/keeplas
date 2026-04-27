"use client";

import * as React from "react";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@keeplas/ui";
import { COUNTRIES, getCountry } from "@/lib/countries";

interface CountryComboboxProps {
  value: string;
  onChange: (code: string) => void;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function CountryCombobox({
  value,
  onChange,
  id,
  disabled,
  placeholder = "Search a country…",
  className,
}: CountryComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = getCountry(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        type="button"
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between gap-3 px-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm text-left transition-colors font-body",
          "hover:border-outline focus:bg-surface-container-high focus:border-secondary/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40",
          "data-[state=open]:bg-surface-container-high",
          "disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer",
          selected ? "text-on-surface" : "text-outline-variant",
          className
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {selected ? (
            <>
              <span aria-hidden className="text-base leading-none">
                {selected.flag}
              </span>
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <span>{placeholder}</span>
          )}
        </span>
        <svg
          className="w-4 h-4 text-on-surface-variant shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m8 9 4-4 4 4M8 15l4 4 4-4"
          />
        </svg>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="p-0 w-[var(--radix-popover-trigger-width)] max-w-md"
      >
        <Command
          filter={(itemValue, search) => {
            const needle = search.toLowerCase();
            return itemValue.toLowerCase().includes(needle) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={placeholder} autoFocus />
          <CommandList>
            <CommandEmpty>No country matches your search.</CommandEmpty>
            {COUNTRIES.map((country) => (
              <CommandItem
                key={country.code}
                value={`${country.name} ${country.code}`}
                onSelect={() => {
                  onChange(country.code);
                  setOpen(false);
                }}
              >
                <span aria-hidden className="text-base leading-none">
                  {country.flag}
                </span>
                <span className="truncate">{country.name}</span>
                <span className="ml-auto text-[10px] tracking-widest text-on-surface-variant uppercase">
                  {country.code}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
