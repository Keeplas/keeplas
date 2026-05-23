"use client";

import Link from "next/link";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

export default function LettersDocPage() {
  return (
    <div className="max-w-screen-md mx-auto space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-label-md text-on-surface-variant">
        <Link href="/docs" className="hover:text-secondary">
          Documentation
        </Link>
        <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        <span className="text-primary">Letters & Messages</span>
      </nav>

      {/* Header */}
      <header className="space-y-4">
        <span className="text-label-md text-secondary">
          Time-released messages
        </span>
        <h1 className="text-headline-lg text-primary">Letters & Messages</h1>
        <p className="text-body-lg text-on-surface-variant">
          Sealed letters released by a specific date or life event. You compose
          them as a vault item — encrypted like everything else — and recipients
          receive them only once your curators validate the trigger.
        </p>
      </header>

      {/* How it works */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-tertiary rounded-full" />
          <h2 className="text-headline-md text-primary">How it works</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Detail
            iconPath={ICON_PATHS.editNote}
            title="Compose from your vault"
            body="Create a Letter / Message item alongside your documents. It is encrypted on-device, like any other vault item."
          />
          <Detail
            iconPath={ICON_PATHS.person}
            title="Assign recipients"
            body="Pre-assign each letter to the people who should receive it. Recipients need no shard and no action of their own."
          />
          <Detail
            iconPath={ICON_PATHS.timer}
            title="Set the trigger"
            body="Release on a fixed date, or on a life event such as your vault opening for inheritance."
          />
          <Detail
            iconPath={ICON_PATHS.verifiedFill}
            title="Released after validation"
            body="Recipients receive the letter once your curators confirm the trigger has been met — never before."
          />
        </div>
      </section>

      {/* Privacy note */}
      <section className="bg-surface-container-low rounded-2xl p-8 ghost-border space-y-4">
        <h2 className="text-headline-sm text-primary">Sealed until the moment</h2>
        <p className="text-body-md text-on-surface-variant">
          A letter stays encrypted in your vault until its trigger fires. Keeplas
          servers only ever hold ciphertext, so no one — not us, not the
          recipient, not your curators — can read it ahead of time.
        </p>
        <Link
          href="/docs/trusted-contacts"
          className="inline-flex items-center gap-2 text-secondary font-bold text-body-md hover:underline"
        >
          How curators validate triggers
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
          href="/docs/vault"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon path={ICON_PATHS.encrypted} className="w-5 h-5 text-secondary" />
          <span className="text-body-md font-medium text-primary">
            Digital Vault
          </span>
        </Link>
      </section>
    </div>
  );
}

function Detail({
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
      <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-tertiary/15 text-tertiary">
        <Icon path={iconPath} className="w-5 h-5" />
      </span>
      <div className="space-y-1">
        <h3 className="text-headline-sm text-primary">{title}</h3>
        <p className="text-body-md text-on-surface-variant">{body}</p>
      </div>
    </article>
  );
}
