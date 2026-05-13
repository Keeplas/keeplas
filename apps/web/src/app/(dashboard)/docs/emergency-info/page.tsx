"use client";

import Link from "next/link";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

export default function EmergencyInfoDocPage() {
  return (
    <div className="max-w-screen-md mx-auto space-y-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-label-md text-on-surface-variant">
        <Link href="/docs" className="hover:text-secondary">
          Documentation
        </Link>
        <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        <span className="text-primary">Acute emergencies</span>
      </nav>

      {/* Header */}
      <header className="space-y-4">
        <span className="text-label-md text-secondary">Acute emergencies</span>
        <h1 className="text-headline-lg text-primary">
          Use your phone&rsquo;s built-in Medical ID.
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          Keeplas focuses on long-term continuity — inheritance, life check,
          shard-based recovery. For accidents and sudden illness, the fastest
          and most reliable tool is already on your phone&rsquo;s lock screen,
          works offline, and is recognized by trained paramedics. Two minutes to
          set up.
        </p>
      </header>

      {/* Why we redirect */}
      <section className="bg-primary text-on-primary rounded-2xl p-8 space-y-3">
        <h2 className="text-headline-sm">Why not a Keeplas card?</h2>
        <p className="text-body-md text-on-primary-container">
          A QR card with your medical info would have to be readable without a
          key — meaning unencrypted on our servers. That contradicts our
          zero-knowledge promise. Apple and Google already solved this on the
          device itself: the data lives on your phone, accessible from the lock
          screen without unlocking, and never reaches a third-party server.
        </p>
      </section>

      {/* iPhone */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-secondary rounded-full" />
          <h2 className="text-headline-md text-primary">iPhone — Medical ID</h2>
        </div>
        <ol className="relative pl-8 border-l-2 border-secondary/20 space-y-6">
          <Step
            value="01"
            title="Open the Health app"
            body="Pre-installed on every iPhone (white icon, red heart). If you removed it, reinstall from the App Store."
          />
          <Step
            value="02"
            title="Tap your profile, then Medical ID"
            body="Top-right corner of Health → your initials → Medical ID."
          />
          <Step
            value="03"
            title="Fill in the essentials"
            body="Name, date of birth, blood type, allergies, medications, conditions, height, weight, organ donor status. Add at least one emergency contact (with the relationship — Mother, Spouse…)."
          />
          <Step
            value="04"
            title="Enable Show When Locked"
            body="Toggle Show When Locked ON — this is the key step. Without it, the data stays behind your passcode and is useless to a first responder."
          />
          <Step
            value="05"
            title="Enable Share During Emergency Call"
            body="Optional but recommended: toggle Share During Emergency Call ON. When you call 911 (or your local equivalent), your Medical ID is shared automatically with dispatch."
          />
        </ol>
        <p className="text-body-md text-on-surface-variant">
          To verify: lock your phone, then on the lock screen press and hold the
          side button + a volume button. You should see an{" "}
          <span className="font-medium text-primary">Emergency</span> slider —
          slide it, then tap{" "}
          <span className="font-medium text-primary">Medical ID</span> at the
          bottom-left. Your info should appear without unlocking.
        </p>
      </section>

      {/* Android */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-2 h-8 bg-primary rounded-full" />
          <h2 className="text-headline-md text-primary">
            Android — Emergency information
          </h2>
        </div>
        <p className="text-body-md text-on-surface-variant">
          Wording varies slightly by manufacturer (Samsung, Pixel, Xiaomi…), but
          the location is consistent.
        </p>
        <ol className="relative pl-8 border-l-2 border-primary/20 space-y-6">
          <Step
            value="01"
            title="Open Settings → Safety & emergency"
            body="On older Android versions: Settings → About phone → Emergency information. On Samsung: Settings → Safety and emergency → Medical info."
          />
          <Step
            value="02"
            title="Add medical information"
            body="Tap Medical info. Fill in blood type, allergies, medications, organ donor, address, medical notes. Same essentials as iPhone."
          />
          <Step
            value="03"
            title="Add emergency contacts"
            body="Back to Safety & emergency → Emergency contacts. Pick people from your address book; the relationship is shown to first responders."
          />
          <Step
            value="04"
            title="Enable lock-screen access"
            body="Most Android phones expose emergency info via the lock screen Emergency button by default — no toggle needed. On Samsung, double-check Settings → Lock screen → Contact information / Medical info is enabled."
          />
          <Step
            value="05"
            title="Enable Emergency SOS (optional)"
            body="Settings → Safety & emergency → Emergency SOS. Lets you trigger a call to local emergency services and share location with your contacts by pressing the power button 5 times."
          />
        </ol>
        <p className="text-body-md text-on-surface-variant">
          To verify: lock your phone, then on the PIN/pattern screen tap{" "}
          <span className="font-medium text-primary">Emergency</span> (or{" "}
          <span className="font-medium text-primary">Emergency call</span>) at
          the bottom. You should see View emergency info or Medical info without
          entering your PIN.
        </p>
      </section>

      {/* What Keeplas does instead */}
      <section className="bg-surface-container-low rounded-2xl p-8 ghost-border space-y-4">
        <h2 className="text-headline-sm text-primary">
          What Keeplas covers, then
        </h2>
        <p className="text-body-md text-on-surface-variant">
          Native Medical ID solves the acute case. Keeplas solves the slower
          one: what happens to your documents, accounts, messages and assets
          when you become unreachable for days, weeks, or permanently. Two
          different problems, two different tools — both worth setting up.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <Link
            href="/trusted-contacts"
            className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
          >
            <Icon path={ICON_PATHS.users} className="w-5 h-5 text-secondary" />
            <span className="text-body-md font-medium text-primary">
              Set up trusted contacts
            </span>
          </Link>
          <Link
            href="/life-check"
            className="bg-surface-container-lowest hover:bg-surface-container rounded-xl p-4 flex items-center gap-3 transition-colors"
          >
            <Icon
              path={ICON_PATHS.heartbeat}
              className="w-5 h-5 text-secondary"
            />
            <span className="text-body-md font-medium text-primary">
              Configure Life Check
            </span>
          </Link>
        </div>
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
