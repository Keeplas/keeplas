import type { InfoCalloutTone } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

export type LegacyTip = {
  slug: string;
  iconKey: keyof typeof ICON_PATHS;
  tone: InfoCalloutTone;
  title: string;
  body: string;
  learnHref?: string;
};

export const LEGACY_TIPS: ReadonlyArray<LegacyTip> = [
  {
    slug: "if-you-died-today",
    iconKey: "helpCircle",
    tone: "warning",
    title: "If you died today, who would access what?",
    body: "Photos, password manager, business email, crypto wallets, the file with your kids' birth certificates. Most people don't know. Map it now — while the choice is still yours.",
  },
  {
    slug: "secrets-die-with-you",
    iconKey: "cloudOff",
    tone: "warning",
    title: "Don't let your secrets die with you",
    body: "iCloud accounts get frozen. Crypto wallets become tombs. Photos vanish behind a forgotten password. A single trusted contact and a recovery phrase prevent every one of these.",
  },
  {
    slug: "probate-vs-grief",
    iconKey: "lockClock",
    tone: "warning",
    title: "Probate moves in months. Families need days.",
    body: "Mortgage payments, subscriptions, insurance claims — they don't pause for grief. Without a plan, loved ones can wait 6–18 months for legal access. Documenting essentials now keeps them out of court.",
  },
  {
    slug: "medical-id",
    iconKey: "medicalInformation",
    tone: "success",
    title: "Set up your phone's Medical ID today",
    body: "Paramedics check the lock screen first. iOS: Health → Medical ID. Android: Settings → Safety & emergency. Add allergies, conditions, and emergency contacts — accessible without unlocking your phone.",
    learnHref: "/docs/emergency-info",
  },
  {
    slug: "emergency-card",
    iconKey: "contactPage",
    tone: "success",
    title: "Carry an Emergency Card",
    body: "First responders need allergies, blood type, and a trusted contact in seconds — not your whole vault. Keeplas can generate a printable card with the bare minimum, leaving the rest sealed.",
  },
  {
    slug: "twenty-four-words",
    iconKey: "key",
    tone: "info",
    title: "Your 24 words are the root key",
    body: "They derive every encryption key on your account. Write them on paper, store them offline. Lose them and no one — not even Keeplas — can recover your vault.",
  },
  {
    slug: "zero-knowledge",
    iconKey: "shieldCheck",
    tone: "info",
    title: "Zero-knowledge by design",
    body: "Your vault is encrypted on your device before it ever reaches our servers. We can't read your data, and neither can anyone we'd be compelled to share it with.",
  },
  {
    slug: "trusted-contacts",
    iconKey: "group",
    tone: "info",
    title: "Trusted contacts unlock continuity",
    body: "Add at least 3 trusted contacts. They can collectively recover your access if you lose your phrase, using cryptographic shards — never the phrase itself.",
    learnHref: "/docs/trusted-contacts",
  },
  {
    slug: "quantum-safe",
    iconKey: "fingerprint",
    tone: "info",
    title: "Quantum-safe encryption",
    body: "We wrap your encryption keys with ML-KEM-768 (NIST FIPS 203), a post-quantum algorithm — your secrets stay safe even against future quantum computers.",
  },
];

export function tipHref(tip: LegacyTip): string {
  return tip.learnHref ?? `/docs/insights#${tip.slug}`;
}
