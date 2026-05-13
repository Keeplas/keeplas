"use client";

import { ContinuityControls } from "@/components/continuity-controls";

export default function SettingsContinuityPage() {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-headline-md text-primary mb-2">
          Continuity Protocol
        </h2>
        <p className="text-body-md text-on-surface-variant max-w-2xl">
          Master pause and Travel Mode for the entire Continuity Protocol.
          Disabling here suspends Life Check escalation and the Scenario Engine
          in lock-step — perfect for off-grid trips. Use Travel Mode when you
          have a return date so everything resumes automatically.
        </p>
      </header>

      <ContinuityControls />
    </div>
  );
}
