"use client";

import Link from "next/link";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

export default function RecoveryDocPage() {
  return (
    <div className="max-w-screen-md mx-auto space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-label-md text-on-surface-variant">
        <Link href="/docs" className="hover:text-secondary">
          Documentation
        </Link>
        <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        <span className="text-primary">Recovery & Inheritance</span>
      </nav>

      {/* Header */}
      <header className="space-y-4">
        <span className="text-label-md text-secondary">Continuity</span>
        <h1 className="text-headline-lg text-primary">
          Recovery & Inheritance
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          Two scenarios, two paths. You lose access while alive — your 24-word
          phrase or your trust contacts get you back in. You become permanently
          unreachable — your trust contacts unlock the vault for your
          recipients.
        </p>
      </header>

      {/* Two paths */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <article className="bg-surface-container-low rounded-2xl p-6 space-y-3 ghost-border">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
            <Icon path={ICON_PATHS.key} className="w-5 h-5" />
          </span>
          <h3 className="text-headline-sm text-primary">
            You are alive
          </h3>
          <p className="text-body-md text-on-surface-variant">
            Path A: 24-word phrase → derives your Root Key locally → unwraps
            your master key. Self-service, no contacts involved.
          </p>
          <p className="text-body-md text-on-surface-variant">
            Path B: Phrase lost too? Your trust contacts can collaborate to
            reconstruct the master key (Shamir social recovery).
          </p>
        </article>

        <article className="bg-primary text-on-primary rounded-2xl p-6 space-y-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10">
            <Icon path={ICON_PATHS.heartbeat} className="w-5 h-5" />
          </span>
          <h3 className="text-headline-sm">You are unreachable</h3>
          <p className="text-body-md text-on-primary-container">
            Life Check fails on every channel → contacts confirm
            unreachability → 72h grace window → contacts submit their shards →
            vault opens in memorial mode → recipients receive their content.
          </p>
        </article>
      </section>

      {/* The 24 words */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-secondary rounded-full" />
          <h2 className="text-headline-md text-primary">
            The 24 words: what they really are
          </h2>
        </div>

        <div className="space-y-4 text-body-md text-on-surface-variant">
          <p>
            At onboarding, your device generates a fresh BIP-39 24-word phrase.
            Those words are <strong className="text-primary">never</strong> sent
            to Keeplas — not even hashed. They exist in three places only:
            your head, your printed Recovery Kit, and (briefly) your browser
            memory during onboarding.
          </p>
          <p>
            The phrase feeds Argon2id (a memory-hard key derivation) along with
            a per-user salt, producing your Root Key. The Root Key wraps your
            Master Key, which is what actually decrypts your vault. The wrapped
            Master Key (`encryptedKeyBundle`) is the only part Keeplas stores —
            and without your phrase, it&apos;s an opaque blob.
          </p>
          <div className="bg-error-container/30 rounded-xl p-4 border-l-4 border-error">
            <p className="text-body-md text-on-surface font-medium">
              If you lose your 24 words, your trust contacts cannot recover
              them — Keeplas cannot recover them either. What contacts{" "}
              <em>can</em> do is rebuild your Master Key directly via Shamir
              quorum. After that, you generate fresh 24 words and the vault
              continues unchanged with a new phrase.
            </p>
          </div>
        </div>
      </section>

      {/* Threshold */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-tertiary rounded-full" />
          <h2 className="text-headline-md text-primary">
            The recovery threshold
          </h2>
        </div>

        <p className="text-body-md text-on-surface-variant">
          During onboarding, you split your Master Key into 5 Shamir shares and
          choose the threshold — the minimum number that must collaborate to
          reconstruct it. The choice is permanent unless you re-distribute
          shards.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {THRESHOLD_OPTIONS.map((option) => (
            <article
              key={option.value}
              className={`rounded-2xl p-4 ghost-border ${option.accent}`}
            >
              <p className="text-headline-md font-bold text-primary">
                {option.value}/5
              </p>
              <p className="text-label-md text-secondary mt-1">
                {option.label}
              </p>
              <p className="text-body-md text-on-surface-variant mt-2">
                {option.body}
              </p>
            </article>
          ))}
        </div>

        <p className="text-body-md text-on-surface-variant">
          Default is <strong className="text-primary">2-of-5</strong> — the
          easiest recovery path while still requiring at least two distinct
          people. If your contacts face a higher collusion risk (e.g. all from
          the same family or workplace), increase it.
        </p>
      </section>

      {/* Post-mortem flow */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-error rounded-full" />
          <h2 className="text-headline-md text-primary">
            Post-mortem flow, step by step
          </h2>
        </div>

        <ol className="relative pl-8 border-l-2 border-error/20 space-y-8">
          <Step
            stage="Detection"
            title="Life Check exhausts every channel"
            body="Passive signals fail (no app activity, no device unlock, no third-party signal of life). The active channels you configured fire one by one — push, email, WhatsApp, SMS, IVR — with the delays you set. The cycle status moves to escalating."
            accent="bg-secondary"
          />
          <Step
            stage="Confirmation"
            title="Trust contacts mark you unreachable"
            body="All your trust contacts receive a notification asking whether they can reach you. From their dashboard they see a Mark as unreachable button (only visible while the cycle is escalating). The threshold number of confirmations opens the 72h grace window."
            accent="bg-tertiary"
          />
          <Step
            stage="Grace window"
            title="72 hours to come back"
            body="If you reappear during these 72 hours and click I am well, the cycle is cancelled, the access request is closed and every contact is notified. Nothing ever leaves your vault."
            accent="bg-warning"
          />
          <Step
            stage="Reconstruction"
            title="Contacts submit their shards"
            body="When the grace window expires, contacts submit their stored shards. Reconstruction happens entirely on-device — Keeplas servers see only encrypted shards, never the master key. The vault opens in read-only memorial mode."
            accent="bg-error"
          />
          <Step
            stage="Distribution"
            title="Recipients receive their content"
            body="Items you pre-assigned to recipients (letters, documents, account credentials, contacts) are released to them according to your routing. Anyone you didn't designate sees nothing."
            accent="bg-primary"
          />
        </ol>
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          href="/docs/trusted-contacts"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon
            path={ICON_PATHS.users}
            className="w-5 h-5 text-secondary"
          />
          <span className="text-body-md font-medium text-primary">
            Trusted Contacts in detail
          </span>
        </Link>
        <Link
          href="/settings/recovery-kit"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon
            path={ICON_PATHS.print}
            className="w-5 h-5 text-secondary"
          />
          <span className="text-body-md font-medium text-primary">
            Export your Recovery Kit
          </span>
        </Link>
      </section>
    </div>
  );
}

const THRESHOLD_OPTIONS = [
  {
    value: 2,
    label: "Easiest",
    body: "Any two contacts. Default recommendation.",
    accent: "bg-secondary-container/40",
  },
  {
    value: 3,
    label: "Balanced",
    body: "Three contacts. Resistant to a single colluding pair.",
    accent: "bg-surface-container-low",
  },
  {
    value: 4,
    label: "Strict",
    body: "Four out of five. Strong, but recovery may stall.",
    accent: "bg-surface-container-low",
  },
  {
    value: 5,
    label: "Maximum",
    body: "All five. No collusion possible — and a single missing contact blocks recovery.",
    accent: "bg-surface-container-low",
  },
];

function Step({
  stage,
  title,
  body,
  accent,
}: {
  stage: string;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <li className="relative">
      <span
        className={`absolute -left-[41px] top-1 w-4 h-4 rounded-full border-4 border-surface ${accent}`}
      />
      <p className="text-label-md text-on-surface-variant uppercase tracking-wide">
        {stage}
      </p>
      <h3 className="text-headline-sm text-primary mt-1">{title}</h3>
      <p className="text-body-md text-on-surface-variant mt-1">{body}</p>
    </li>
  );
}
