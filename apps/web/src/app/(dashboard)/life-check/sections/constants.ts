import { ICON_PATHS } from "@/lib/icons";

export const FREQUENCIES = [
  { value: "weekly", label: "7", unit: "Days", description: "Active" },
  { value: "monthly", label: "30", unit: "Days", description: "Recommended" },
  { value: "quarterly", label: "90", unit: "Days", description: "Relaxed" },
] as const;

export type Frequency = (typeof FREQUENCIES)[number]["value"];

export type ChannelType = "push" | "email" | "first_responder";

export interface ChannelConfig {
  type: ChannelType;
  label: string;
  description: string;
  iconPath: string;
  delayHours: number;
  isEnabled: boolean;
  order: number;
}

const EMAIL_ICON_PATH =
  "M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75";

export const DEFAULT_CHANNELS: ChannelConfig[] = [
  {
    type: "push",
    label: "App Push Notification",
    description: "Encrypted mobile ping — tap to confirm",
    iconPath: ICON_PATHS.bell,
    delayHours: 24,
    isEnabled: true,
    order: 1,
  },
  {
    type: "email",
    label: "Email Verification",
    description: "Sent to primary & recovery address",
    iconPath: EMAIL_ICON_PATH,
    delayHours: 48,
    isEnabled: true,
    order: 2,
  },
  {
    type: "first_responder",
    label: "First Responder Alert",
    description: "Your designated First Responder is notified",
    iconPath: ICON_PATHS.users,
    delayHours: 24,
    isEnabled: true,
    order: 3,
  },
];
