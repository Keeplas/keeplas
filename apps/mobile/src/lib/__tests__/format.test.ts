import { countryName } from "../format";

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
