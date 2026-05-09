"use client";

import Link from "next/link";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

interface Feature {
  title: string;
  description: string;
  iconPath: string;
  href: string;
  accent: string;
}

const CORE_FEATURES: Feature[] = [
  {
    title: "Digital Vault",
    description:
      "Zero-knowledge storage for documents, credentials, financial assets and digital legacy. Everything is encrypted on your device before it leaves.",
    iconPath: ICON_PATHS.lock,
    href: "/vault",
    accent: "bg-secondary/10 text-secondary",
  },
  {
    title: "Life Check",
    description:
      "Automated proof-of-life across email, SMS, WhatsApp and IVR. Configurable cadence with a travel-mode pause for trips.",
    iconPath: ICON_PATHS.heartbeat,
    href: "/life-check",
    accent: "bg-error/10 text-error",
  },
  {
    title: "Scenario Engine",
    description:
      "Compose the chain of autonomous actions that fire when life check thresholds are crossed — T+7, T+30, T+60 inactivity milestones.",
    iconPath: ICON_PATHS.shieldCheck,
    href: "/life-check?tab=reaction",
    accent: "bg-primary/10 text-primary",
  },
  {
    title: "Letters & Messages",
    description:
      "Sealed letters released by specific life events or dates. Compose them as a Letter / Message item from your vault — recipients receive them once curators validate the trigger.",
    iconPath: ICON_PATHS.notes,
    href: "/vault",
    accent: "bg-tertiary/15 text-tertiary",
  },
  {
    title: "Acute emergencies",
    description:
      "For accidents and sudden illness, your phone's native Medical ID is on the lock screen, recognized by paramedics, and works offline. Here is how to set it up.",
    iconPath: ICON_PATHS.medicalInformation,
    href: "/docs/emergency-info",
    accent: "bg-secondary/10 text-secondary",
  },
  {
    title: "Trusted Contacts",
    description:
      "Up to five trust contacts hold encrypted shards of your master key. They confirm your unavailability and reconstruct the vault when needed. Recipients receive your pre-assigned content separately.",
    iconPath: ICON_PATHS.users,
    href: "/docs/trusted-contacts",
    accent: "bg-primary/10 text-primary",
  },
  {
    title: "Recovery & Inheritance",
    description:
      "Two paths: 24-word phrase for self-service recovery, Shamir social recovery via trust contacts when the phrase is lost or after you become unreachable. Configurable threshold (2-of-5 default).",
    iconPath: ICON_PATHS.key,
    href: "/docs/recovery",
    accent: "bg-tertiary/15 text-tertiary",
  },
  {
    title: "Reflect & Prepare",
    description:
      "Nine honest cases — reflective questions, real pain points, emergency essentials, and the cryptographic foundations behind Keeplas. ~10 minutes to read.",
    iconPath: ICON_PATHS.psychology,
    href: "/docs/insights",
    accent: "bg-secondary/10 text-secondary",
  },
];

interface SecurityPoint {
  title: string;
  body: string;
  iconPath: string;
}

const SECURITY_POINTS: SecurityPoint[] = [
  {
    title: "Zero-knowledge encryption",
    body: "Your master key is derived locally and never sent to Keeplas. Every vault item is encrypted with AES-256-GCM before upload. Keeplas servers see only ciphertext.",
    iconPath: ICON_PATHS.shieldCheck,
  },
  {
    title: "Shamir secret sharing",
    body: "Your master key is split into 5 cryptographic shards. You choose the threshold at onboarding (2 to 5) — lower means easier recovery, higher means stronger collusion resistance. Reconstruction always happens on your contacts' devices, never on Keeplas servers.",
    iconPath: ICON_PATHS.hub,
  },
  {
    title: "Hash-chained audit log",
    body: "Every action writes an immutable tamper-evident entry. Each log hash links to the previous one; rewriting history would break the chain.",
    iconPath: ICON_PATHS.key,
  },
  {
    title: "Recovery kit on paper",
    body: "Export a printable document with your 24-word phrase. Cold-storage only — Keeplas does not store the phrase nor any hash of it. The phrase derives your Root Key locally via Argon2id.",
    iconPath: ICON_PATHS.print,
  },
];

const QUICK_LINKS: Array<{ label: string; href: string; iconPath: string }> = [
  { label: "Hub", href: "/hub", iconPath: ICON_PATHS.hub },
  { label: "Security Center", href: "/settings/security", iconPath: ICON_PATHS.key },
  { label: "Recovery Kit", href: "/settings/recovery-kit", iconPath: ICON_PATHS.key },
  { label: "Subscription", href: "/settings/subscription", iconPath: ICON_PATHS.creditCard },
];

export default function DocsPage() {
  return (
    <div className="max-w-screen-2xl mx-auto space-y-16">
      {/* Header */}
      <header className="space-y-4">
        <span className="text-label-md text-secondary">
          Documentation
        </span>
        <h1 className="text-headline-lg text-primary">
          How Keeplas protects your legacy.
        </h1>
        <p className="text-body-lg text-on-surface-variant max-w-2xl">
          Keeplas is a life-continuity platform. We combine a zero-knowledge vault, a
          multi-channel life check, an autonomous scenario engine and a social recovery
          network so your digital legacy outlives you — on your terms.
        </p>
      </header>

      {/* Hero zero-knowledge explainer */}
      <section className="bg-primary text-on-primary rounded-[2rem] p-10 md:p-12 relative overflow-hidden">
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-secondary/10 blur-[100px] pointer-events-none" />
        <div className="relative z-10 space-y-5 max-w-2xl">
          <span className="inline-flex items-center px-3 py-1 bg-white/10 backdrop-blur rounded-full text-label-md border border-white/20">
            Zero-knowledge by design
          </span>
          <h2 className="text-headline-lg">
            Your key never leaves your device.
          </h2>
          <p className="text-body-lg text-on-primary-container">
            The master key that unlocks your vault is generated and stored only on your
            devices. Keeplas servers hold encrypted blobs plus the public metadata needed
            to orchestrate life checks — nothing more. Even we cannot read your vault.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/settings/recovery-kit"
              className="inline-flex items-center gap-2 bg-secondary-fixed text-on-secondary-fixed font-headline font-extrabold px-6 py-3 rounded-xl hover:opacity-90 transition-all active:scale-95"
            >
              Export Recovery Kit
            </Link>
            <Link
              href="/settings/security"
              className="inline-flex items-center gap-2 border border-white/20 text-white px-6 py-3 rounded-xl hover:bg-white/10 transition-all font-headline font-bold"
            >
              Security Center
            </Link>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-secondary rounded-full" />
          <h2 className="text-headline-md text-primary">
            Core Features
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CORE_FEATURES.map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="bg-surface-container-low rounded-2xl p-6 ghost-border hover:bg-surface-container transition-colors group flex flex-col gap-4"
            >
              <span
                className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${feature.accent}`}
              >
                <Icon path={feature.iconPath} className="w-5 h-5" />
              </span>
              <div className="space-y-2">
                <h3 className="text-headline-sm text-primary">
                  {feature.title}
                </h3>
                <p className="text-body-md text-on-surface-variant">
                  {feature.description}
                </p>
              </div>
              <span className="mt-auto pt-2 flex items-center gap-2 text-label-md text-secondary">
                Open
                <Icon
                  path={ICON_PATHS.chevronRight}
                  className="w-3 h-3 group-hover:translate-x-1 transition-transform"
                />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Security model */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-primary rounded-full" />
          <h2 className="text-headline-md text-primary">
            Security Model
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SECURITY_POINTS.map((point) => (
            <article
              key={point.title}
              className="bg-surface-container-lowest rounded-2xl p-6 ghost-border flex gap-4"
            >
              <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/10 text-secondary">
                <Icon path={point.iconPath} className="w-5 h-5" />
              </span>
              <div className="space-y-1">
                <h3 className="text-headline-sm text-primary">
                  {point.title}
                </h3>
                <p className="text-body-md text-on-surface-variant">
                  {point.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Lifecycle flow */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-error rounded-full" />
          <h2 className="text-headline-md text-primary">
            What happens after inactivity
          </h2>
        </div>
        <ol className="relative pl-8 border-l-2 border-secondary/20 space-y-8">
          <LifecycleStep
            value="Detection"
            title="Passive signals fail"
            body="Confidence score drops below 50: no app activity, no device unlock, no third-party signal of life. A Life Check cycle opens."
            accent="bg-secondary"
          />
          <LifecycleStep
            value="Outreach"
            title="Active channels fire"
            body="Push, email, WhatsApp, SMS, IVR — your configured channels notify you in order, with the delays you set. Each non-response moves the cycle to escalating."
            accent="bg-secondary/60"
          />
          <LifecycleStep
            value="Confirmation"
            title="Trust contacts mark you unreachable"
            body="All your trust contacts can confirm unreachability from their hub. The threshold number of confirmations opens the 72-hour grace window."
            accent="bg-tertiary"
          />
          <LifecycleStep
            value="Grace 72h"
            title="Last chance to come back"
            body="If you sign in and click I am well, the cycle is cancelled. Nothing leaves the vault."
            accent="bg-warning"
          />
          <LifecycleStep
            value="Reconstruction"
            title="Vault opens for inheritance"
            body="Contacts submit their shards. Threshold reached → master key reconstructed on their device → vault opens read-only → recipients receive their pre-assigned items."
            accent="bg-error"
          />
        </ol>
        <div className="pt-4">
          <Link
            href="/docs/recovery"
            className="inline-flex items-center gap-2 text-secondary font-bold text-body-md hover:underline"
          >
            Read the full recovery & inheritance flow
            <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
          </Link>
        </div>
      </section>

      {/* Quick links */}
      <section className="bg-surface-container-low rounded-2xl p-8 ghost-border">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
          <div>
            <h2 className="text-headline-sm text-primary">
              Jump to a feature
            </h2>
            <p className="text-body-md text-on-surface-variant mt-1">
              All documentation is inline with the product — each screen has its own
              guided empty state and tooltips.
            </p>
          </div>
        </div>
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {QUICK_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container transition-colors text-body-md font-medium text-primary"
              >
                <Icon path={link.iconPath} className="w-4 h-4 text-secondary shrink-0" />
                <span className="truncate">{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="pt-8 pb-12 text-center text-body-md text-on-surface-variant">
        Keeplas — Life Continuity Protocol · Version 0.1
      </footer>
    </div>
  );
}

function LifecycleStep({
  value,
  title,
  body,
  accent,
}: {
  value: string;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <li className="relative">
      <span
        className={`absolute -left-[41px] top-1 w-4 h-4 rounded-full border-4 border-surface ${accent}`}
      />
      <p className="text-label-md text-on-surface-variant">
        {value} days inactivity
      </p>
      <h3 className="text-headline-sm text-primary mt-1">{title}</h3>
      <p className="text-body-md text-on-surface-variant mt-1 max-w-xl">
        {body}
      </p>
    </li>
  );
}
