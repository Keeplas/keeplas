import { ICON_PATHS } from "@/lib/icons";

export const FREQUENCIES = [
  { value: "weekly", label: "7", unit: "Days", description: "Active" },
  { value: "monthly", label: "30", unit: "Days", description: "Recommended" },
  { value: "quarterly", label: "90", unit: "Days", description: "Relaxed" },
] as const;

export type Frequency = (typeof FREQUENCIES)[number]["value"];

export type ChannelType = "push" | "email" | "whatsapp";

export interface ChannelConfig {
  type: ChannelType;
  label: string;
  description: string;
  iconPath: string;
  isEnabled: boolean;
  order: number;
  isUpcoming?: boolean; // not yet available (e.g. no mobile app); shown disabled
}

const EMAIL_ICON_PATH =
  "M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75";

const WHATSAPP_ICON_PATH =
  "M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z";

// Channels Keeplas sends a check-in on — all at once, no cascade. Only the
// email button and a WhatsApp reply can actually confirm liveness; push is a
// reminder that deep-links into the app.
export const DEFAULT_CHANNELS: ChannelConfig[] = [
  {
    type: "whatsapp",
    label: "WhatsApp Message",
    description: "Reply to confirm you're well",
    iconPath: WHATSAPP_ICON_PATH,
    isEnabled: true,
    order: 1,
  },
  {
    type: "push",
    label: "App Push Notification",
    description: "Encrypted mobile ping — tap to confirm",
    iconPath: ICON_PATHS.bell,
    isEnabled: false,
    order: 2,
    isUpcoming: true,
  },
  {
    type: "email",
    label: "Email Verification",
    description: "One-click button to confirm you're well",
    iconPath: EMAIL_ICON_PATH,
    isEnabled: true,
    order: 3,
  },
];
