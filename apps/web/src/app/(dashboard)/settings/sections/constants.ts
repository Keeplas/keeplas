export const LANGUAGES = [
  { value: "en-US", label: "English" },
  { value: "fr-FR", label: "Français" },
  { value: "es-ES", label: "Spanish (Español)", upcoming: true },
  { value: "pt-PT", label: "Portuguese (Português)", upcoming: true },
];

export const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "KES", label: "KES (KSh)" },
  { value: "NGN", label: "NGN (₦)" },
  { value: "ZAR", label: "ZAR (R)" },
  { value: "AED", label: "AED (د.إ)" },
  { value: "SGD", label: "SGD (S$)" },
  { value: "SAR", label: "SAR (﷼)" },
];

export const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "Europe/Paris", label: "Europe / Paris" },
  { value: "Europe/London", label: "Europe / London" },
  { value: "America/New_York", label: "America / New York" },
  { value: "America/Los_Angeles", label: "America / San Francisco" },
  { value: "Africa/Nairobi", label: "Africa / Nairobi" },
  { value: "Asia/Tokyo", label: "Asia / Tokyo" },
  { value: "Africa/Lagos", label: "Africa / Lagos" },
  { value: "Africa/Johannesburg", label: "Africa / Johannesburg" },
  { value: "Asia/Dubai", label: "Asia / Dubai" },
  { value: "Asia/Singapore", label: "Asia / Singapore" },
  { value: "Asia/Riyadh", label: "Asia / Riyadh" },
];

export interface NotificationPrefs {
  lifeCheckReminders: boolean;
  vaultAccessAlerts: boolean;
  newsletterUpdates: boolean;
}

export interface SecurityPrefs {
  twoFactor: boolean;
  biometric: boolean;
}

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  lifeCheckReminders: true,
  vaultAccessAlerts: true,
  newsletterUpdates: false,
};

export const DEFAULT_SECURITY: SecurityPrefs = {
  twoFactor: false,
  biometric: false,
};
