import { fromPickerDate, latestBirthday, toPickerDate } from "../birthday";

describe("birthday picker dates", () => {
  it("shows the stored UTC day as the same local day", () => {
    const stored = Date.UTC(1998, 8, 11);
    const shown = toPickerDate(stored);
    expect([shown.getFullYear(), shown.getMonth(), shown.getDate()]).toEqual([
      1998, 8, 11,
    ]);
  });

  it("stores the picked local day at UTC midnight, like the web app", () => {
    const picked = new Date(1998, 8, 11, 23, 30);
    expect(fromPickerDate(picked)).toBe(Date.parse("1998-09-11T00:00:00Z"));
  });

  it("round-trips a stored birthday", () => {
    const stored = Date.UTC(1975, 0, 1);
    expect(fromPickerDate(toPickerDate(stored))).toBe(stored);
  });

  it("caps the picker at 18 years ago today", () => {
    const latest = latestBirthday(new Date(2026, 9, 26, 10, 51));
    expect([latest.getFullYear(), latest.getMonth(), latest.getDate()]).toEqual(
      [2008, 9, 26],
    );
  });
});
