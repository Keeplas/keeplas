// Birthdays are stored as UTC midnight of the calendar day (same as the web
// app); the native picker works in local time, so convert by calendar fields.

export function toPickerDate(birthday: number): Date {
  const day = new Date(birthday);
  return new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
}

export function fromPickerDate(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/** The server refuses anyone under 18: today, 18 years ago. */
export function latestBirthday(now = new Date()): Date {
  return new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
}
