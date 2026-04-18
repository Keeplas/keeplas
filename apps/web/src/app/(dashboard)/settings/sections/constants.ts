export const LANGUAGES = [
  { value: "en-US", label: "English (United States)" },
  { value: "fr-FR", label: "French (Français)" },
  { value: "es-ES", label: "Spanish (Español)" },
  { value: "sw-KE", label: "Swahili (Kiswahili)" },
  { value: "ja-JP", label: "Japanese (日本語)" },
];

export const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "KES", label: "KES (KSh)" },
];

export const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "Europe/Paris", label: "Europe / Paris" },
  { value: "Europe/London", label: "Europe / London" },
  { value: "America/New_York", label: "America / New York" },
  { value: "Africa/Nairobi", label: "Africa / Nairobi" },
  { value: "Asia/Tokyo", label: "Asia / Tokyo" },
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
