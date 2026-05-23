"use client";

import Link from "next/link";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

export default function VaultDocPage() {
  return (
    <div className="max-w-screen-md mx-auto space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-label-md text-on-surface-variant">
        <Link href="/docs" className="hover:text-secondary">
          Documentation
        </Link>
        <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        <span className="text-primary">Digital Vault</span>
      </nav>

      {/* Header */}
      <header className="space-y-4">
        <span className="text-label-md text-secondary">Encrypted storage</span>
        <h1 className="text-headline-lg text-primary">Digital Vault</h1>
        <p className="text-body-lg text-on-surface-variant">
          Zero-knowledge storage for documents, credentials, financial assets
          and your digital legacy. Everything is encrypted on your device before
          it ever leaves it — Keeplas only ever holds ciphertext.
        </p>
      </header>

      {/* How encryption works */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-primary rounded-full" />
          <h2 className="text-headline-md text-primary">
            How encryption works
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <article className="bg-surface-container-low rounded-2xl p-6 space-y-3 ghost-border">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/10 text-secondary">
              <Icon path={ICON_PATHS.encrypted} className="w-5 h-5" />
            </span>
            <h3 className="text-headline-sm text-primary">
              Encrypted on-device
            </h3>
            <p className="text-body-md text-on-surface-variant">
              Each item is encrypted with AES-256-GCM in your browser before
              upload. Plaintext never travels over the network.
            </p>
          </article>
          <article className="bg-surface-container-low rounded-2xl p-6 space-y-3 ghost-border">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/10 text-secondary">
              <Icon path={ICON_PATHS.key} className="w-5 h-5" />
            </span>
            <h3 className="text-headline-sm text-primary">
              Your key, your key
            </h3>
            <p className="text-body-md text-on-surface-variant">
              The master key that unlocks your vault is derived locally from
              your 24-word phrase and never sent to Keeplas.
            </p>
          </article>
          <article className="bg-surface-container-low rounded-2xl p-6 space-y-3 ghost-border">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/10 text-secondary">
              <Icon path={ICON_PATHS.shieldCheck} className="w-5 h-5" />
            </span>
            <h3 className="text-headline-sm text-primary">
              Servers stay blind
            </h3>
            <p className="text-body-md text-on-surface-variant">
              Keeplas stores only encrypted blobs plus the public metadata
              needed to orchestrate recovery. Even we cannot read your vault.
            </p>
          </article>
        </div>
      </section>

      {/* What you can store */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-secondary rounded-full" />
          <h2 className="text-headline-md text-primary">What you can store</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StoreItem
            iconPath={ICON_PATHS.description}
            title="Documents"
            body="Identity papers, contracts, wills, insurance policies — any file that matters to your succession."
          />
          <StoreItem
            iconPath={ICON_PATHS.lock}
            title="Credentials"
            body="Passwords, access codes and account details, sealed behind your master key."
          />
          <StoreItem
            iconPath={ICON_PATHS.accountBalance}
            title="Financial assets"
            body="Bank accounts, investments and crypto holdings, with the context your heirs need to act."
          />
          <StoreItem
            iconPath={ICON_PATHS.notes}
            title="Letters & Messages"
            body="Time-released letters sealed until a date or life event. See the Letters & Messages guide."
          />
        </div>
      </section>

      {/* Storage quotas */}
      <section className="bg-surface-container-low rounded-2xl p-8 ghost-border space-y-4">
        <h2 className="text-headline-sm text-primary">Storage included</h2>
        <p className="text-body-md text-on-surface-variant">
          The Free plan includes 100 MB of encrypted storage. The Lifetime plan
          raises it to 10 GB. Encryption overhead is counted against your quota.
        </p>
        <Link
          href="/settings/subscription"
          className="inline-flex items-center gap-2 text-secondary font-bold text-body-md hover:underline"
        >
          Compare plans
          <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        </Link>
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          href="/vault"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon path={ICON_PATHS.lock} className="w-5 h-5 text-secondary" />
          <span className="text-body-md font-medium text-primary">
            Open your vault
          </span>
        </Link>
        <Link
          href="/docs/letters"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon path={ICON_PATHS.notes} className="w-5 h-5 text-secondary" />
          <span className="text-body-md font-medium text-primary">
            Letters & Messages
          </span>
        </Link>
      </section>
    </div>
  );
}

function StoreItem({
  iconPath,
  title,
  body,
}: {
  iconPath: string;
  title: string;
  body: string;
}) {
  return (
    <article className="bg-surface-container-lowest rounded-2xl p-6 ghost-border flex gap-4">
      <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/10 text-secondary">
        <Icon path={iconPath} className="w-5 h-5" />
      </span>
      <div className="space-y-1">
        <h3 className="text-headline-sm text-primary">{title}</h3>
        <p className="text-body-md text-on-surface-variant">{body}</p>
      </div>
    </article>
  );
}
