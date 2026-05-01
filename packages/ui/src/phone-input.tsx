"use client";

import * as React from "react";
import {
  AsYouType,
  parsePhoneNumber,
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";

export type { CountryCode };
import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "./command";
import { Input } from "./input";
import { cn } from "./lib/utils";

interface PhoneCountry {
  code: CountryCode;
  name: string;
  flag: string;
  dialCode: string;
}

const REGIONAL_INDICATOR_OFFSET = 0x1f1e6;

function flagFromCode(code: string): string {
  if (code.length !== 2) return "";
  const a = code.charCodeAt(0) - 65;
  const b = code.charCodeAt(1) - 65;
  return String.fromCodePoint(
    REGIONAL_INDICATOR_OFFSET + a,
    REGIONAL_INDICATOR_OFFSET + b
  );
}

const REGION_NAMES =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const COUNTRIES: readonly PhoneCountry[] = (() => {
  const list: PhoneCountry[] = [];
  for (const code of getCountries()) {
    let dialCode: string;
    try {
      dialCode = getCountryCallingCode(code);
    } catch {
      continue;
    }
    list.push({
      code,
      name: REGION_NAMES?.of(code) ?? code,
      flag: flagFromCode(code),
      dialCode,
    });
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
})();

const COUNTRY_SET = new Set<string>(COUNTRIES.map((c) => c.code));

function isKnownCountry(code: string | undefined): code is CountryCode {
  return !!code && COUNTRY_SET.has(code);
}

const FALLBACK_COUNTRY: CountryCode = "FR";

function detectBrowserCountry(): CountryCode | undefined {
  if (typeof navigator === "undefined") return undefined;
  const lang = navigator.language;
  if (!lang) return undefined;
  const parts = lang.split("-");
  const region = parts[1]?.toUpperCase();
  return isKnownCountry(region) ? region : undefined;
}

function resolveDefaultCountry(
  preferred: CountryCode | undefined
): CountryCode {
  if (isKnownCountry(preferred)) return preferred;
  const browser = detectBrowserCountry();
  if (browser) return browser;
  return FALLBACK_COUNTRY;
}

function safeParse(value: string) {
  try {
    return parsePhoneNumber(value);
  } catch {
    return undefined;
  }
}

export function normalizePhone(
  value: string | undefined
): string | undefined {
  if (!value) return undefined;
  const parsed = safeParse(value);
  return parsed?.isValid() ? parsed.number : undefined;
}

export function isValidPhone(value: string | undefined): boolean {
  if (!value) return true;
  return safeParse(value)?.isValid() ?? false;
}

function buildE164(country: CountryCode, national: string): string | undefined {
  const digits = national.replace(/\D+/g, "");
  if (!digits) return undefined;
  return `+${getCountryCallingCode(country)}${digits}`;
}

export interface PhoneInputProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  defaultCountry?: CountryCode;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}

export function PhoneInput({
  value,
  onChange,
  defaultCountry,
  disabled,
  id,
  placeholder,
  invalid,
  className,
}: PhoneInputProps) {
  const [country, setCountry] = React.useState<CountryCode>(() =>
    resolveDefaultCountry(defaultCountry)
  );
  const [nationalDisplay, setNationalDisplay] = React.useState<string>("");
  const [internalInvalid, setInternalInvalid] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const lastEmitted = React.useRef<string | undefined>(undefined);
  const initialized = React.useRef(false);

  React.useEffect(() => {
    if (value === lastEmitted.current && initialized.current) return;
    initialized.current = true;
    lastEmitted.current = value;
    if (!value) {
      setNationalDisplay("");
      setInternalInvalid(false);
      return;
    }
    if (value.startsWith("+")) {
      const parsed = safeParse(value);
      if (parsed && parsed.country && isKnownCountry(parsed.country)) {
        setCountry(parsed.country);
        setNationalDisplay(parsed.formatNational());
        setInternalInvalid(!parsed.isValid());
        return;
      }
      // Unparseable +-prefixed value: surface as-is, mark invalid.
      setNationalDisplay(value);
      setInternalInvalid(true);
      return;
    }
    // Legacy raw value with no + prefix.
    setNationalDisplay(value);
    setInternalInvalid(true);
  }, [value]);

  const emit = React.useCallback(
    (next: string | undefined) => {
      lastEmitted.current = next;
      onChange(next);
    },
    [onChange]
  );

  function handleNationalChange(raw: string) {
    if (!raw) {
      setNationalDisplay("");
      setInternalInvalid(false);
      emit(undefined);
      return;
    }

    // If user typed a "+" prefix, let AsYouType detect the country.
    if (raw.startsWith("+")) {
      const formatter = new AsYouType();
      const formatted = formatter.input(raw);
      const detected = formatter.getCountry();
      if (detected && isKnownCountry(detected)) {
        setCountry(detected);
        const national = formatter.getNumber()?.formatNational() ?? formatted;
        setNationalDisplay(national);
        const number = formatter.getNumber()?.number;
        setInternalInvalid(!formatter.getNumber()?.isValid());
        emit(number ?? buildE164(detected, formatted));
        return;
      }
      setNationalDisplay(formatted);
      setInternalInvalid(true);
      emit(raw);
      return;
    }

    const formatter = new AsYouType(country);
    const formatted = formatter.input(raw);
    setNationalDisplay(formatted);
    const e164 = formatter.getNumber()?.number ?? buildE164(country, raw);
    setInternalInvalid(false);
    emit(e164);
  }

  function handleCountrySelect(next: CountryCode) {
    setCountry(next);
    setOpen(false);
    if (!nationalDisplay) {
      emit(undefined);
      return;
    }
    const formatter = new AsYouType(next);
    const formatted = formatter.input(nationalDisplay);
    setNationalDisplay(formatted);
    const e164 = formatter.getNumber()?.number ?? buildE164(next, nationalDisplay);
    emit(e164);
  }

  function handleBlur() {
    const current = lastEmitted.current;
    if (!current) {
      setInternalInvalid(false);
      return;
    }
    setInternalInvalid(!isValidPhone(current));
  }

  const selected = COUNTRIES.find((c) => c.code === country);
  const showInvalid = invalid || internalInvalid;
  const dialCode = selected?.dialCode ?? "";
  const flag = selected?.flag ?? "";

  return (
    <div className={cn("flex w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Select country"
            className={cn(
              "flex items-center gap-1.5 px-3 py-3 bg-surface-container-low border border-outline-variant rounded-l-xl border-r-0 text-on-surface hover:border-outline focus:border-secondary/15 focus:bg-surface-container-high transition-all focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer shrink-0",
              showInvalid && "border-error"
            )}
          >
            <span aria-hidden className="text-base leading-none">
              {flag || country}
            </span>
            <span className="text-body-md text-on-surface-variant">
              +{dialCode}
            </span>
            <svg
              className="w-3.5 h-3.5 text-on-surface-variant"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m19.5 8.25-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[320px] p-0 max-h-[360px]"
        >
          <Command>
            <CommandInput placeholder="Search country" />
            <CommandList>
              <CommandEmpty>No country found.</CommandEmpty>
              {COUNTRIES.map((c) => (
                <CommandItem
                  key={c.code}
                  value={`${c.name} ${c.code} ${c.dialCode}`}
                  onSelect={() => handleCountrySelect(c.code)}
                >
                  <span aria-hidden className="text-base leading-none">
                    {c.flag || c.code}
                  </span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-on-surface-variant text-label-md">
                    +{c.dialCode}
                  </span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={nationalDisplay}
        onChange={(e) => handleNationalChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder ?? "Phone number"}
        disabled={disabled}
        aria-invalid={showInvalid || undefined}
        className={cn(
          "rounded-l-none border-l-0 flex-1 min-w-0",
          showInvalid && "border-error focus:border-error"
        )}
      />
    </div>
  );
}
