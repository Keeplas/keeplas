import {
  ageInYears,
  countdownParts,
  countryName,
  formatDate,
  placeName,
} from "../format";

describe("countryName", () => {
  // Hermes ships without Intl.DisplayNames; names must not depend on it.
  const displayNames = Intl.DisplayNames;
  beforeAll(() => {
    // @ts-expect-error simulate the Hermes runtime
    delete Intl.DisplayNames;
  });
  afterAll(() => {
    Object.assign(Intl, { DisplayNames: displayNames });
  });

  it("names a country in English and French", () => {
    expect(countryName("FR", "en")).toBe("France");
    expect(countryName("DE", "fr")).toBe("Allemagne");
  });

  it("falls back to the code when unknown", () => {
    expect(countryName("XX", "en")).toBe("XX");
  });
});

describe("placeName", () => {
  it("joins the city and the localized country", () => {
    expect(placeName({ city: "Montréal", country: "CA" }, "fr")).toBe(
      "Montréal, Canada",
    );
    expect(placeName({ country: "FR" }, "en")).toBe("France");
    expect(placeName({}, "en")).toBeNull();
  });
});

describe("countdownParts", () => {
  const now = Date.UTC(2026, 9, 23, 12, 0, 0);

  it("splits the time left into days, hours, minutes and seconds", () => {
    const target = now + ((2 * 24 + 3) * 3_600 + 4 * 60 + 5) * 1000;
    expect(countdownParts(target, now)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
    });
  });

  it("stops at zero once the deadline has passed", () => {
    expect(countdownParts(now - 60_000, now)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });
});

describe("formatDate", () => {
  it("keeps a UTC calendar date on that day when asked", () => {
    const birthday = Date.parse("1990-03-01T00:00:00Z");
    expect(formatDate(birthday, "en-US", "UTC")).toBe("Mar 1, 1990");
  });
});

describe("ageInYears", () => {
  it("counts full years only", () => {
    const now = Date.UTC(2026, 9, 25);
    expect(ageInYears(Date.UTC(1990, 2, 1), now)).toBe(36);
    expect(ageInYears(Date.UTC(2008, 9, 26), now)).toBe(17);
  });
});
