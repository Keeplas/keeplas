"use client";

import Link from "next/link";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

export default function LifeCheckDocPage() {
  return (
    <div className="max-w-screen-md mx-auto space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-label-md text-on-surface-variant">
        <Link href="/docs" className="hover:text-secondary">
          Documentation
        </Link>
        <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        <span className="text-primary">Life Check</span>
      </nav>

      {/* Header */}
      <header className="space-y-4">
        <span className="text-label-md text-secondary">Proof of life</span>
        <h1 className="text-headline-lg text-primary">Life Check</h1>
        <p className="text-body-lg text-on-surface-variant">
          A transparent proof-of-life system. Keeplas reaches you over WhatsApp
          and email on a cadence you set; an explicit reply resets the
          countdown. Only prolonged silence ever moves your vault toward
          recovery.
        </p>
      </header>

      {/* How it works */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-secondary rounded-full" />
          <h2 className="text-headline-md text-primary">How it works</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Detail
            iconPath={ICON_PATHS.verifiedUser}
            title="Verify each channel once"
            body="Confirm your WhatsApp number and email so we can reliably reach you. App push is coming soon."
          />
          <Detail
            iconPath={ICON_PATHS.timer}
            title="Set your cadence"
            body="Choose how often a check-in opens. Between cycles, Keeplas stays silent."
          />
          <Detail
            iconPath={ICON_PATHS.notificationsActive}
            title="A 15-day window with reminders"
            body="When a cycle opens, WhatsApp and email fire at day 0, with reminders at day 3, 7 and 10."
          />
          <Detail
            iconPath={ICON_PATHS.checkCircle}
            title="An explicit reply resets it"
            body="One tap in the email, or a WhatsApp reply, resets the countdown. Browsing the app does not count — only an explicit 'I'm well'."
          />
          <Detail
            iconPath={ICON_PATHS.globe}
            title="Travel mode"
            body="Pause checks for a trip so a missed message never escalates while you're away."
          />
          <Detail
            iconPath={ICON_PATHS.visibility}
            title="Always visible"
            body="A live countdown shows exactly where you stand. No hidden timers, no silent resets."
          />
        </div>
      </section>

      {/* After inactivity */}
      <section className="bg-surface-container-low rounded-2xl p-8 ghost-border space-y-4">
        <h2 className="text-headline-sm text-primary">
          What happens if you don&apos;t respond
        </h2>
        <p className="text-body-md text-on-surface-variant">
          If the whole 15-day window passes with no reply, your trust contacts
          are asked to confirm they can&apos;t reach you. Only then — after a
          further confirmation window and a 72-hour grace period — does recovery
          begin. You can cancel at any point by signing in and clicking I am
          well.
        </p>
        <Link
          href="/docs/recovery"
          className="inline-flex items-center gap-2 text-secondary font-bold text-body-md hover:underline"
        >
          Read the full recovery & inheritance flow
          <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        </Link>
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link
          href="/life-check"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon
            path={ICON_PATHS.heartbeat}
            className="w-5 h-5 text-secondary"
          />
          <span className="text-body-md font-medium text-primary">
            Go to Life Check
          </span>
        </Link>
        <Link
          href="/docs/trusted-contacts"
          className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
        >
          <Icon path={ICON_PATHS.users} className="w-5 h-5 text-secondary" />
          <span className="text-body-md font-medium text-primary">
            Trusted contacts
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
