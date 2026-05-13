"use client";

import Link from "next/link";
import { Icon, InfoCallout } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { LEGACY_TIPS, type LegacyTip } from "@/lib/legacy-tips";

const TONE_LABELS: Record<LegacyTip["tone"], string> = {
  warning: "Reflect",
  success: "Practical",
  info: "How Keeplas works",
};

export default function InsightsDocPage() {
  return (
    <div className="max-w-screen-md mx-auto space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-label-md text-on-surface-variant">
        <Link href="/docs" className="hover:text-secondary">
          Documentation
        </Link>
        <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        <span className="text-primary">Reflect & Prepare</span>
      </nav>

      {/* Header */}
      <header className="space-y-4">
        <span className="text-label-md text-secondary">Reflect & Prepare</span>
        <h1 className="text-headline-lg text-primary">
          Nine honest cases for digital continuity.
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          Three reflections, one pain point, two emergency essentials, and three
          foundations. Skim the table of contents or read top-to-bottom — each
          section stands on its own.
        </p>
      </header>

      {/* Table of contents */}
      <nav className="bg-surface-container-low rounded-2xl p-6">
        <h2 className="text-label-md text-on-surface-variant mb-4">
          In this guide
        </h2>
        <ol className="space-y-2 list-decimal list-inside">
          {LEGACY_TIPS.map((tip) => (
            <li key={tip.slug} className="text-body-md">
              <a
                href={`#${tip.slug}`}
                className="text-primary hover:text-secondary"
              >
                {tip.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* 1 — If you died today */}
      <Section slug="if-you-died-today" tone="warning" iconKey="helpCircle">
        <p>
          Take ninety seconds. Picture every account, file, and key in your life
          — and then picture them gone. Your phone passcode. Your password
          manager master key. The drive with the kids&rsquo; photos. The crypto
          seed phrase you wrote down somewhere &laquo; safe &raquo;. The login
          to the small business email forwarding addressed to your home. Most
          adults manage more than a hundred online accounts and almost none of
          them are mapped, named, or transferable.
        </p>
        <p>
          The point of this question isn&rsquo;t to be morbid — it&rsquo;s to
          turn a vague worry into a concrete checklist. You can&rsquo;t protect
          what you haven&rsquo;t named. So before you do anything else, write
          down the categories that matter for <em>your</em> life:
        </p>
        <ul className="list-disc list-inside space-y-1 text-body-md text-on-surface-variant">
          <li>Identity & legal documents (passport, ID, birth certificates)</li>
          <li>Money (banks, brokerage, crypto wallets, retirement)</li>
          <li>Cloud (photos, drive, password manager, email)</li>
          <li>People (who needs to be contacted, who&rsquo;d step in)</li>
          <li>
            Wishes (medical directives, organ donor status, funeral notes)
          </li>
        </ul>
        <p>
          Mapping is the act. Choosing who gets what is the gift. The rest of
          this guide is how Keeplas — and a few habits outside Keeplas — make
          that gift durable.
        </p>
      </Section>

      {/* 2 — Don't let your secrets die with you */}
      <Section slug="secrets-die-with-you" tone="warning" iconKey="cloudOff">
        <p>
          When someone dies without a digital plan, three patterns repeat. The
          iCloud account quietly freezes — Apple now offers a Legacy Contact,
          but only if it&rsquo;s set up <em>before</em> death; otherwise the
          family faces a court order or a permanent lock. Crypto wallets become
          tombs the moment a seed phrase is missing — there is no support line,
          no &laquo; forgot password &raquo;, no recovery. Photos and documents
          on a phone protected by Face ID and an unknown passcode are
          functionally lost.
        </p>
        <p>
          None of these failures need a sophisticated attacker. They happen
          because the systems we depend on every day are designed for a single
          living user, not for transfer. The fix is small: a phrase you can
          write down, a contact who knows where it is, and a tool that can
          release it on the right conditions.
        </p>
        <p>
          That is the ten-minute version of what Keeplas does. Add the few
          things you would not want to lose, name a trusted contact or two, and
          the cliff becomes a slope.
        </p>
        <Link
          href="/vault"
          className="inline-flex items-center gap-2 text-body-md text-secondary hover:underline"
        >
          Open your vault
          <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4" />
        </Link>
      </Section>

      {/* 3 — Probate moves in months */}
      <Section slug="probate-vs-grief" tone="warning" iconKey="lockClock">
        <p>
          Probate — the legal process that grants someone authority over a
          deceased person&rsquo;s estate — typically takes{" "}
          <strong>six to eighteen months</strong>, depending on the jurisdiction
          and the complexity of the estate. In some countries it&rsquo;s faster,
          in many it&rsquo;s slower. None of those timelines match the speed of
          life.
        </p>
        <p>
          Within the first thirty days after a death, the family usually has to:
          pay the mortgage, keep insurance policies current, contest or confirm
          subscriptions, file a death notice with banks, and find a dozen
          account passwords that nobody wrote down. Without prepared access, all
          of this either falls on one exhausted relative or waits — accruing
          late fees, lapsing coverage, locking accounts.
        </p>
        <p>
          Documenting your essentials now isn&rsquo;t a substitute for a will.
          It&rsquo;s the bridge that gets your family through the first month
          while the legal machinery catches up. Keeplas releases the information
          you&rsquo;ve curated — not your whole life, just what you chose — to
          the people you chose, on the timeline you chose.
        </p>
        <Link
          href="/docs/recovery"
          className="inline-flex items-center gap-2 text-body-md text-secondary hover:underline"
        >
          Read the recovery & inheritance guide
          <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4" />
        </Link>
      </Section>

      {/* 4 — Medical ID (teaser → existing guide) */}
      <Section slug="medical-id" tone="success" iconKey="medicalInformation">
        <p>
          For accidents and sudden illness, the fastest tool is already on your
          phone: the built-in Medical ID. It lives on your lock screen, works
          offline, requires no app, and is what trained paramedics actually look
          for first. Two minutes to set up on iPhone or Android.
        </p>
        <InfoCallout icon={ICON_PATHS.info} tone="info">
          We deliberately don&rsquo;t replicate Medical ID inside Keeplas — a QR
          card readable without a key would break our zero-knowledge promise,
          and the operating system already solved this problem on the device
          itself.
        </InfoCallout>
        <Link
          href="/docs/emergency-info"
          className="inline-flex items-center gap-2 text-body-md text-secondary hover:underline"
        >
          Step-by-step setup for iPhone & Android
          <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4" />
        </Link>
      </Section>

      {/* 5 — Emergency Card */}
      <Section slug="emergency-card" tone="success" iconKey="contactPage">
        <p>
          Medical ID is excellent. Paper still beats it in a few specific
          situations: a dead phone battery, a foreign emergency room where
          paramedics aren&rsquo;t looking for the iOS lock-screen flow, a phone
          left in another room, a guardian who needs your blood type read aloud
          over a phone call.
        </p>
        <p>
          A printed Emergency Card is the offline complement. It carries the
          bare minimum a first responder or trusted person needs in the first
          ten minutes — and nothing else. Specifically:
        </p>
        <ul className="list-disc list-inside space-y-1 text-body-md text-on-surface-variant">
          <li>Your name, date of birth, blood type</li>
          <li>Allergies, current medications, critical conditions</li>
          <li>Two emergency contacts with their relationship to you</li>
          <li>One sentence on advance directives or organ donor status</li>
        </ul>
        <p>
          Crucially, none of your vault — no documents, no credentials, no
          inheritance instructions — appears on this card. The card opens the
          first door; the rest stays sealed behind your zero-knowledge keys.
        </p>
        <Link
          href="/trusted-contacts"
          className="inline-flex items-center gap-2 text-body-md text-secondary hover:underline"
        >
          Pick the contacts who go on your card
          <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4" />
        </Link>
      </Section>

      {/* 6 — 24 words */}
      <Section slug="twenty-four-words" tone="info" iconKey="key">
        <p>
          Your 24-word recovery phrase isn&rsquo;t a password — it&rsquo;s the
          mathematical seed every encryption key on your account is derived
          from. We use the BIP-39 standard you may have seen in crypto wallets,
          paired with Argon2id key derivation that turns the phrase into your
          Root Key locally, on your device. The phrase itself never leaves your
          device, and Keeplas servers never store it nor any hash of it.
        </p>
        <p>
          That&rsquo;s the strength: the system has no fallback that bypasses
          the phrase, which is exactly what makes it impossible for us — or
          anyone we&rsquo;d be compelled to share with — to read your data.
          That&rsquo;s also the responsibility: if you lose the phrase and you
          haven&rsquo;t set up trusted contacts, the vault is gone.
        </p>
        <p>
          The right way to store 24 words is offline, on paper or steel, ideally
          in two separate physical locations (a fire-resistant box and a sealed
          envelope at a relative&rsquo;s home, for example). Never store them in
          a screenshot, a note app, an email draft, or a password manager —
          those defeat the entire purpose.
        </p>
        <Link
          href="/settings/recovery-kit"
          className="inline-flex items-center gap-2 text-body-md text-secondary hover:underline"
        >
          Generate or print your Recovery Kit
          <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4" />
        </Link>
      </Section>

      {/* 7 — Zero-knowledge */}
      <Section slug="zero-knowledge" tone="info" iconKey="shieldCheck">
        <p>
          Zero-knowledge is the cryptographic guarantee that a service can store
          your data without ever being able to read it. In Keeplas, your master
          key is derived locally from your 24-word phrase and never leaves your
          device. Every vault item is encrypted with AES-256-GCM on your device
          before upload. What we hold on our servers is mathematically opaque
          ciphertext.
        </p>
        <p>
          The practical comparison: with traditional cloud storage (or most
          consumer password managers), the service holds a key that can unlock
          your data — under a court order, a leaked credential, or a rogue
          employee, that data becomes legible. With zero-knowledge, the
          ciphertext stays ciphertext until your device unlocks it.
        </p>
        <p>
          The implication you should understand clearly: there is no &laquo;
          reset password and recover &raquo; path. The two real recovery paths
          are the 24-word phrase (self-service) and Shamir social recovery via
          your trusted contacts (when the phrase is lost). That&rsquo;s the
          whole shape of the system.
        </p>
      </Section>

      {/* 8 — Trusted Contacts (teaser → existing guide) */}
      <Section slug="trusted-contacts" tone="info" iconKey="group">
        <p>
          Trusted contacts are the people who can collectively unlock your
          continuity if you lose your phrase or become unreachable. They
          don&rsquo;t hold your phrase — they hold cryptographic <em>shards</em>{" "}
          of your master key, generated through Shamir secret sharing. A
          configurable threshold (2-of-5 by default) must agree before recovery
          proceeds, and reconstruction always happens on their devices, never on
          Keeplas servers.
        </p>
        <p>
          Pick at least three. Pick people in different households, ideally
          different cities. Pick the ones who would actually pick up the phone
          in a hard week.
        </p>
        <Link
          href="/docs/trusted-contacts"
          className="inline-flex items-center gap-2 text-body-md text-secondary hover:underline"
        >
          Read the trusted contacts deep-dive
          <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4" />
        </Link>
      </Section>

      {/* 9 — Quantum-safe */}
      <Section slug="quantum-safe" tone="info" iconKey="fingerprint">
        <p>
          The biggest cryptographic risk to legacy data isn&rsquo;t
          today&rsquo;s attackers — it&rsquo;s tomorrow&rsquo;s. The pattern is
          called <em>harvest now, decrypt later</em>: well-funded adversaries
          are recording encrypted traffic and stored ciphertext today, betting
          that a future quantum computer will break the underlying algorithms
          and let them read what was captured years earlier.
        </p>
        <p>
          For consumer chat or short-lived sessions this is mostly theoretical.
          For inheritance and continuity data — which has to remain confidential
          for decades — it&rsquo;s a real planning horizon. That&rsquo;s why
          Keeplas wraps every per-recipient data encryption key, and every
          Shamir shard, with <strong>ML-KEM-768</strong> (NIST FIPS 203), the
          post-quantum key encapsulation standard ratified in 2024. It replaces
          RSA-OAEP on the wrapping layer.
        </p>
        <p>
          The user-visible impact is essentially zero: same flows, same
          performance. The future-visible impact is that ciphertext captured
          today should still be unreadable when post-quantum decryption becomes
          feasible.
        </p>
      </Section>

      {/* Footer back-link */}
      <section className="bg-surface-container-low rounded-2xl p-8 ghost-border space-y-3">
        <h2 className="text-headline-sm text-primary">Done reading?</h2>
        <p className="text-body-md text-on-surface-variant">
          Head back to your hub and turn one of these cases into an action.
        </p>
        <Link
          href="/hub"
          className="inline-flex items-center gap-2 text-body-md text-secondary hover:underline"
        >
          Return to the Hub
          <Icon path={ICON_PATHS.arrowRight} className="w-4 h-4" />
        </Link>
      </section>
    </div>
  );
}

function Section({
  slug,
  tone,
  iconKey,
  children,
}: {
  slug: LegacyTip["slug"];
  tone: LegacyTip["tone"];
  iconKey: LegacyTip["iconKey"];
  children: React.ReactNode;
}) {
  const tip = LEGACY_TIPS.find((t) => t.slug === slug);
  if (!tip) return null;
  return (
    <section
      id={slug}
      className="scroll-mt-24 space-y-5 border-t border-outline-variant/30 pt-12"
    >
      <div className="flex items-center gap-3">
        <span className="w-2 h-8 bg-secondary rounded-full" />
        <span className="text-label-md text-secondary uppercase tracking-wide">
          {TONE_LABELS[tone]}
        </span>
      </div>
      <div className="flex items-start gap-4">
        <Icon
          path={ICON_PATHS[iconKey]}
          className="w-7 h-7 text-secondary shrink-0 mt-1"
        />
        <h2 className="text-headline-md text-primary">{tip.title}</h2>
      </div>
      <div className="space-y-4 text-body-md text-on-surface-variant leading-relaxed">
        {children}
      </div>
    </section>
  );
}
