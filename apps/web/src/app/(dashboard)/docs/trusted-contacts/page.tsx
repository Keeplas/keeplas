"use client";

import Link from "next/link";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

export default function TrustedContactsDocPage() {
  return (
    <div className="max-w-screen-md mx-auto space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-label-md text-on-surface-variant">
        <Link href="/docs" className="hover:text-secondary">
          Documentation
        </Link>
        <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        <span className="text-primary">Trusted Contacts</span>
      </nav>

      {/* Header */}
      <header className="space-y-4">
        <span className="text-label-md text-secondary">Recovery network</span>
        <h1 className="text-headline-lg text-primary">Trusted Contacts</h1>
        <p className="text-body-lg text-on-surface-variant">
          The people you designate to protect your vault — both during your life
          (in case you lose access) and after (for your digital succession). One
          unified role, one mental model.
        </p>
      </header>

      {/* Two roles */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-primary rounded-full" />
          <h2 className="text-headline-md text-primary">Two roles, only</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <article className="bg-primary text-on-primary rounded-2xl p-6 space-y-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10">
              <Icon path={ICON_PATHS.shieldCheck} className="w-5 h-5" />
            </span>
            <h3 className="text-headline-sm">Trust contact</h3>
            <p className="text-body-md text-on-primary-container">
              Holds an encrypted shard of your master key. Can confirm you are
              unreachable. Participates in the cryptographic quorum that
              re-opens your vault.
            </p>
            <ul className="text-body-md text-on-primary-container space-y-1 pt-2">
              <li>· Minimum 2 trust contacts for recovery</li>
              <li>· Up to 3 shard holders in the current recovery model</li>
              <li>· Receives 1 Shamir shard, encrypted to their public key</li>
              <li>
                · Active role at three moments: invitation, escalation, recovery
              </li>
            </ul>
          </article>

          <article className="bg-surface-container-low rounded-2xl p-6 space-y-3 ghost-border">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/10 text-secondary">
              <Icon path={ICON_PATHS.users} className="w-5 h-5" />
            </span>
            <h3 className="text-headline-sm text-primary">Recipient</h3>
            <p className="text-body-md text-on-surface-variant">
              Receives specific items you pre-assigned (letters, documents,
              account details) once your vault is opened post-mortem. Passive
              role: no shard, no validation, no action required of them.
            </p>
            <ul className="text-body-md text-on-surface-variant space-y-1 pt-2">
              <li>· No cap — invite as many as you need</li>
              <li>· No cryptographic responsibility</li>
              <li>· Receives content only after the vault unlocks</li>
            </ul>
          </article>
        </div>
      </section>

      {/* What a trust contact does */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-secondary rounded-full" />
          <h2 className="text-headline-md text-primary">
            What a trust contact does
          </h2>
        </div>

        <ol className="relative pl-8 border-l-2 border-secondary/20 space-y-8">
          <Step
            value="01"
            title="Accepts the invitation"
            body="To invite them you provide their name, email, and optionally their phone number. They receive an email with a one-time link. When they accept and create their own vault, those identifiers are pre-filled and locked on the signup form, so their account matches the identity you registered. They sign in to Keeplas, which generates their own ML-KEM keypair on-device; the public key is uploaded so you can wrap their shard to it."
          />
          <Step
            value="02"
            title="Receives their shard (silently)"
            body="When you click Distribute now, your client wraps their Shamir share to their public key and stores the ciphertext on the server. The next time they open /shared-with-me, their browser unwraps it on-device, persists the raw bytes in their IndexedDB, and stamps lastVerifiedAt as cryptographic proof that the unwrap worked. No manual click, no copy-paste — and Keeplas servers never see the raw shard."
          />
          <Step
            value="03"
            title="Confirms unreachability (if needed)"
            body="If your Life Check escalates and you stop responding, all your trust contacts are notified. Each can mark you as unreachable from their hub. Once the threshold is reached, a 72-hour grace window opens — during which you can still cancel by signing in."
          />
          <Step
            value="04"
            title="Submits their shard at recovery"
            body="After the grace window expires (or you manually trigger social recovery), contacts open /shared-with-me and click Submit my shard. Their browser pulls their shard from IndexedDB, wraps a copy for every peer's public key, and uploads the envelopes — the contact never sees, types, or exports the raw bytes. Once the threshold is reached, any submitter can click Reconstruct master key: their device fetches the wrapped-for-them envelopes, unwraps them, combines with its own raw shard, and rebuilds the master key entirely on-device. Servers see only ciphertext throughout."
          />
        </ol>
      </section>

      {/* Threshold link */}
      <section className="bg-surface-container-low rounded-2xl p-8 ghost-border space-y-4">
        <h2 className="text-headline-sm text-primary">
          How many contacts must agree?
        </h2>
        <p className="text-body-md text-on-surface-variant">
          You choose the recovery threshold during onboarding. Threshold 2 is
          the default and works from 2 trusted contacts. Threshold 3 is stricter
          and requires 3 ready contacts.
        </p>
        <Link
          href="/docs/recovery"
          className="inline-flex items-center gap-2 text-secondary font-bold text-body-md hover:underline"
        >
          Recovery model
          <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        </Link>
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          href="/trusted-contacts"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon path={ICON_PATHS.users} className="w-5 h-5 text-secondary" />
          <span className="text-body-md font-medium text-primary">
            Manage your contacts
          </span>
        </Link>
        <Link
          href="/docs/recovery"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon path={ICON_PATHS.key} className="w-5 h-5 text-secondary" />
          <span className="text-body-md font-medium text-primary">
            Recovery & inheritance flow
          </span>
        </Link>
      </section>
    </div>
  );
}

function Step({
  value,
  title,
  body,
}: {
  value: string;
  title: string;
  body: string;
}) {
  return (
    <li className="relative">
      <span className="absolute -left-[41px] top-1 w-4 h-4 rounded-full border-4 border-surface bg-secondary" />
      <p className="text-label-md text-on-surface-variant">{value}</p>
      <h3 className="text-headline-sm text-primary mt-1">{title}</h3>
      <p className="text-body-md text-on-surface-variant mt-1">{body}</p>
    </li>
  );
}
