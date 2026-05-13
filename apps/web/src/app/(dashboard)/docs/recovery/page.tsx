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
          <h3 className="text-headline-sm text-primary">You are alive</h3>
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
            Life Check fails on every channel → contacts confirm unreachability
            → 72h grace window → contacts submit their shards → vault opens in
            memorial mode → recipients receive their content.
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
            to Keeplas — not even hashed. They exist in three places only: your
            head, your printed Recovery Kit, and (briefly) your browser memory
            during onboarding.
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
              If you lose your 24 words, your trust contacts cannot recover them
              — Keeplas cannot recover them either. What contacts <em>can</em>{" "}
              do is rebuild your Master Key directly via Shamir quorum. After
              that, you generate fresh 24 words and the vault continues
              unchanged with a new phrase.
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
            body="All your trust contacts receive a notification asking whether they can reach you. From their hub they see a Mark as unreachable button (only visible while the cycle is escalating). The threshold number of confirmations opens the 72h grace window."
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

      {/* Zero-knowledge guarantees */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-primary rounded-full" />
          <h2 className="text-headline-md text-primary">
            Why this stays zero-knowledge
          </h2>
        </div>

        <div className="space-y-4 text-body-md text-on-surface-variant">
          <p>
            Throughout the entire lifecycle — distribution, reception,
            verification, recovery — Keeplas servers never see a raw shard and
            never see your master key. They store only ciphertext blobs wrapped
            to specific public keys, plus public metadata (timestamps, audit
            logs, threshold values).
          </p>

          <ul className="space-y-2 pl-4 list-disc">
            <li>
              <strong className="text-primary">Distribution</strong>: each shard
              is wrapped to its target contact&apos;s ML-KEM public key before
              it leaves your device. The server stores only the envelope.
            </li>
            <li>
              <strong className="text-primary">Reception</strong>: the
              contact&apos;s browser unwraps the envelope using its locally held
              private key and persists the raw shard in IndexedDB. Nothing about
              the raw bytes is ever sent back.
            </li>
            <li>
              <strong className="text-primary">Verification</strong>:
              successfully unwrapping the shard automatically stamps
              <code className="text-secondary mx-1">lastVerifiedAt</code> on the
              contact&apos;s row. That timestamp is just an attestation; the
              server can&apos;t and doesn&apos;t inspect the shard.
            </li>
            <li>
              <strong className="text-primary">Recovery submission</strong>:
              when contacts submit their shard, each one wraps a copy for every
              peer&apos;s public key (fan-out). The server stores the fan-out
              envelopes — still ciphertext only.
            </li>
            <li>
              <strong className="text-primary">Reconstruction</strong>: the
              Shamir interpolation that rebuilds the master key happens entirely
              in the contact&apos;s browser. The master key never touches a
              server, by construction.
            </li>
          </ul>

          <div className="bg-primary/5 rounded-xl p-4 border-l-4 border-primary">
            <p className="text-body-md text-on-surface font-medium">
              Trade-off worth knowing: with threshold = 2, two colluding
              contacts can both confirm unreachability AND open the vault. The
              Life Check escalation + the 72h grace window are the only extra
              safeguards. If you anticipate that risk (e.g. all your contacts
              share a household), raise your threshold at onboarding.
            </p>
          </div>
        </div>
      </section>

      {/* How a contact actually uses their shard */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-secondary rounded-full" />
          <h2 className="text-headline-md text-primary">
            How a contact uses their shard
          </h2>
        </div>

        <p className="text-body-md text-on-surface-variant">
          Trust contacts never have to type, copy, export or back up their
          shard. The browser handles the bytes invisibly. Here&apos;s what a
          contact actually sees and does:
        </p>

        <ol className="relative pl-8 border-l-2 border-secondary/20 space-y-6">
          <Step
            stage="Day 0"
            title="They accept your invitation"
            body="They sign in to Keeplas, generate their own ML-KEM keypair on-device, and the public half is uploaded so you can wrap shards to it."
            accent="bg-secondary/40"
          />
          <Step
            stage="Distribution"
            title="They visit /shared-with-me once"
            body="Their browser auto-unwraps the encrypted shard you distributed and stores the raw bytes in their IndexedDB. The card shows Hash verified [just now]. No button to click."
            accent="bg-secondary"
          />
          <Step
            stage="Recovery time"
            title="They click Submit my shard"
            body="Either after the post-mortem grace window expires, or after you trigger a social recovery while alive. Their browser reads the local shard, wraps a copy for each peer, uploads the fan-out envelopes."
            accent="bg-tertiary"
          />
          <Step
            stage="Reconstruction"
            title="They click Reconstruct master key"
            body="Once the threshold has submitted, their browser fetches the envelopes addressed to them, unwraps them with their private key, combines with its own raw shard, and rebuilds the master key locally. From there the vault can be decrypted in memorial read-only mode."
            accent="bg-error"
          />
        </ol>
      </section>

      {/* Cross-device behaviour */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-tertiary rounded-full" />
          <h2 className="text-headline-md text-primary">
            What happens if a contact changes device
          </h2>
        </div>

        <p className="text-body-md text-on-surface-variant">
          A trust contact who switches phones, factory-resets their device,
          opens an incognito window, or signs in on a new laptop does not lose
          their shard. The architecture handles this without any manual export,
          copy-paste or special action.
        </p>

        <div className="space-y-4 text-body-md text-on-surface-variant">
          <p>
            <strong className="text-primary">
              The contact&apos;s ML-KEM keypair is portable.
            </strong>{" "}
            Their secret key is stored on the server, AES-GCM-encrypted under
            their own master key. As soon as they unlock their vault on the new
            device — with their 24-word phrase or via Device Unlock — the secret
            key is decrypted in their browser, ready to use.
          </p>
          <p>
            <strong className="text-primary">
              The encrypted shard is still on the server.
            </strong>{" "}
            Your client wrapped it to their public key during distribution; the
            ciphertext lives in your{" "}
            <code className="text-secondary">trusted_contacts</code> row. It
            never depended on a specific device.
          </p>
          <p>
            <strong className="text-primary">
              Auto-restoration runs on the next visit.
            </strong>{" "}
            When the contact opens /shared-with-me on the new device, a brief
            “Restoring your shards…” banner appears while the browser unwraps
            the server envelope and persists the raw bytes in the new
            device&apos;s IndexedDB. From there, every recovery action works
            exactly like before.
          </p>
        </div>

        <div className="bg-error-container/30 rounded-xl p-4 border-l-4 border-error">
          <p className="text-body-md text-on-surface font-medium mb-2">
            The only failure mode: a contact loses BOTH their device AND their
            24-word phrase.
          </p>
          <p className="text-body-md text-on-surface-variant">
            Without the phrase, they can&apos;t unlock their master key — so
            they can&apos;t decrypt their ML-KEM secret key — so they can&apos;t
            unwrap their shard. Their slot is effectively permanent dead weight.
            As the vault owner, you should revoke them, invite a replacement,
            then click <strong>Distribute now</strong> to issue fresh shards to
            all current trust contacts.
          </p>
        </div>
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          href="/docs/trusted-contacts"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon path={ICON_PATHS.users} className="w-5 h-5 text-secondary" />
          <span className="text-body-md font-medium text-primary">
            Trusted Contacts in detail
          </span>
        </Link>
        <Link
          href="/settings/recovery-kit"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon path={ICON_PATHS.print} className="w-5 h-5 text-secondary" />
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
