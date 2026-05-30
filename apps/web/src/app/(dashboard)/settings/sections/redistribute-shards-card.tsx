"use client";

import { useQuery } from "convex/react";
import { Button, HelpHint } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import {
  useDistributeShards,
  MIN_TRUST_CONTACTS_FOR_RECOVERY,
} from "@/lib/use-distribute-shards";

/**
 * Settings-side action: explicit, always-visible re-distribution of recovery
 * shards. Mirrors the contextual prompt that lives on /trusted-contacts but
 * exposed here so the user can rotate shards on demand (e.g. after
 * onboarding a replacement guardian, or as a periodic hygiene task).
 *
 * Re-distribution always re-splits the master key — any previously held
 * shard becomes obsolete. That's by design: the threshold is the contract,
 * not a per-contact setting.
 */
export function RedistributeShardsCard() {
  const targets = useQuery(api.trusted_contacts.getDistributionTargets);
  const me = useQuery(api.onboarding.getOnboardingState);
  const { distribute, status, error } = useDistributeShards();

  const eligible = targets ?? [];
  const threshold = me?.vaultThreshold ?? 2;
  const belowMin = eligible.length < MIN_TRUST_CONTACTS_FOR_RECOVERY;
  const disabled = status === "running" || belowMin;

  return (
    <section className="bg-surface-container p-6 md:p-8 rounded-2xl">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h2 className="text-headline-md text-primary inline-flex items-center gap-2">
            Re-distribute recovery shards
            <HelpHint content="Re-splits your master key with your chosen threshold and re-seals every trust contact's shard to their public key. Any previously held shard becomes obsolete the moment you click — by design. Use this after onboarding a replacement guardian, or as a periodic hygiene task." />
          </h2>
          <p className="text-body-md text-on-surface-variant mt-1">
            {eligible.length === 0
              ? "Invite at least 2 trust contacts and wait for them to accept before you can distribute."
              : belowMin
                ? "Only 1 eligible trust contact. Recovery needs at least 2 — invite and confirm one more before distributing."
                : `${eligible.length} eligible trust contacts · current threshold ${threshold}.`}
          </p>
        </div>
        <Button
          variant="vault"
          size="md"
          onClick={() => void distribute()}
          disabled={disabled}
          className="cursor-pointer shrink-0"
        >
          {status === "running" ? "Distributing…" : "Distribute now"}
        </Button>
      </div>

      {status === "ok" && (
        <p className="text-label-md text-secondary mt-2">
          Shards re-distributed. Contacts will pick up the new envelopes on
          their next visit to /shared-with-me.
        </p>
      )}
      {(status === "error" || status === "insufficient_contacts") && error && (
        <p className="text-label-md text-error mt-2">{error}</p>
      )}
      {status === "missing_master_key" && (
        <p className="text-label-md text-error mt-2">
          Unlock your vault first, then retry.
        </p>
      )}
    </section>
  );
}
