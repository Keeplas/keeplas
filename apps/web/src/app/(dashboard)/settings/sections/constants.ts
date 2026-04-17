export const SECTIONS = [
  {
    id: "identity",
    label: "Identity",
    icon: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
  },
  {
    id: "security",
    label: "Security",
    icon: "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z",
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: "M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0",
  },
  {
    id: "access",
    label: "Vault Access",
    icon: "M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z",
  },
  {
    id: "billing",
    label: "Billing",
    icon: "M2.25 8.25h19.5M2.25 9v10.125c0 1.036.84 1.875 1.875 1.875h15.75c1.035 0 1.875-.84 1.875-1.875V9M10 14h4",
  },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

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
