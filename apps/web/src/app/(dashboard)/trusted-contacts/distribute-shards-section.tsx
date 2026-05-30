"use client";

import { useQuery } from "convex/react";
import { Button, HelpHint } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import {
  useDistributeShards,
  MIN_TRUST_CONTACTS_FOR_RECOVERY,
} from "@/lib/use-distribute-shards";
import { useTranslations } from "@/lib/i18n";

/**
 * Owner-side action card surfaced when at least one trust contact has
 * accepted but is still missing their wrapped shard. Triggers a re-split
 * + fan-out distribution.
 */
export function DistributeShardsSection() {
  const t = useTranslations("trustedContacts");
  const targets = useQuery(api.trusted_contacts.getDistributionTargets);
  const { distribute, status, error } = useDistributeShards();

  if (!targets || targets.length === 0) return null;

  const pending = targets.filter((t) => !t.shardConfirmed);
  // Below the recovery floor, distribution is pointless (and blocked backend-
  // side) — surface the requirement instead of a distribute prompt.
  const belowMin = targets.length < MIN_TRUST_CONTACTS_FOR_RECOVERY;
  // Allow re-distribution even when all are confirmed (e.g., threshold change),
  // but only surface a prompt when something is missing.
  if (pending.length === 0 && status !== "ok" && !belowMin) return null;

  return (
    <section className="bg-surface-container-low rounded-2xl p-6 border-l-4 border-tertiary">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="text-headline-sm text-primary inline-flex items-center gap-2">
            {t("distribute.heading")}
            <HelpHint content={t("distribute.help")} />
          </h3>
          <p className="text-body-md text-on-surface-variant mt-1">
            {belowMin
              ? t("distribute.belowMin")
              : pending.length > 0
                ? targets.length > 1
                  ? t("distribute.pendingMany", {
                      pending: pending.length,
                      total: targets.length,
                    })
                  : t("distribute.pendingOne", {
                      pending: pending.length,
                      total: targets.length,
                    })
                : t("distribute.allCurrent")}
          </p>
        </div>
        <Button
          variant="vault"
          size="md"
          onClick={() => void distribute()}
          disabled={status === "running" || belowMin}
          className="cursor-pointer shrink-0"
        >
          {status === "running"
            ? t("distribute.distributing")
            : t("distribute.distributeNow")}
        </Button>
      </div>

      {status === "ok" && (
        <p className="text-label-md text-secondary mt-2">
          {t("distribute.success")}
        </p>
      )}
      {status === "insufficient_contacts" && error && (
        <p className="text-label-md text-error mt-2">{error}</p>
      )}
      {status === "error" && error && (
        <p className="text-label-md text-error mt-2">{error}</p>
      )}
      {status === "missing_master_key" && (
        <p className="text-label-md text-error mt-2">
          {t("distribute.missingMasterKey")}
        </p>
      )}
    </section>
  );
}
