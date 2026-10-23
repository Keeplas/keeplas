import { useState } from "react";
import { getLocales } from "expo-localization";

import { isCountryCode, toE164, type CountryCode } from "./phone";

function deviceCountry(): CountryCode {
  const region = getLocales()[0]?.regionCode;
  return isCountryCode(region) ? region : "US";
}

/** State of a Phone Input: country (device region by default) + number. */
export function usePhoneField(
  initial: { country?: CountryCode; number?: string } = {},
) {
  const [country, setCountry] = useState<CountryCode>(
    () => initial.country ?? deviceCountry(),
  );
  const [number, setNumber] = useState(initial.number ?? "");
  const [invalid, setInvalid] = useState(false);

  return {
    inputProps: {
      country,
      onCountryChange: setCountry,
      value: number,
      onChangeText: (value: string) => {
        setNumber(value);
        setInvalid(false);
      },
      invalid,
    },
    /** E.164 when valid; flags the field otherwise. */
    validate(): string | null {
      const e164 = toE164(country, number);
      setInvalid(!e164);
      return e164;
    },
  };
}
