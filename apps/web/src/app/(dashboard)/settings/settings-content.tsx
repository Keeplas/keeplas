"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { ErrorAlert, Loader } from "@keeplas/ui";
import { BillingSection } from "./sections/billing-section";
import { IdentitySection } from "./sections/identity-section";
import { PreferencesSection } from "./sections/preferences-section";
import { SecuritySection } from "./sections/security-section";
import { SettingsNav } from "./sections/settings-nav";
import { useActiveSection } from "./sections/use-active-section";
import { VaultAccessSection } from "./sections/vault-access-section";

export function SettingsContent() {
  const user = useQuery(api.users.viewer);
  const [activeSection, setActiveSection] = useActiveSection();
  const [error, setError] = useState("");

  if (user === undefined) {
    return <Loader />;
  }

  if (user === null) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-12 md:space-y-16">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <span className="text-secondary font-headline font-extrabold uppercase tracking-[0.2em] text-[11px]">
            Settings & Curation
          </span>
          <h1 className="text-primary font-headline text-3xl md:text-4xl font-black tracking-tight leading-none">
            Identity & Control.
          </h1>
        </div>
        <p className="text-on-surface-variant max-w-sm leading-relaxed text-sm">
          Configure your digital sanctuary. These settings ensure your legacy remains protected and accessible only to those you trust.
        </p>
      </header>

      <SettingsNav
        activeSection={activeSection}
        onSelect={setActiveSection}
      />

      {error && <ErrorAlert message={error} />}

      <IdentitySection user={user} onError={setError} />
      <SecuritySection />
      <PreferencesSection user={user} onError={setError} />
      <VaultAccessSection />
      <BillingSection />
    </div>
  );
}
