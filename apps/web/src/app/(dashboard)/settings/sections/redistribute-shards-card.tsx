import { useQuery } from "convex/react";
import { Button, HelpHint } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import {
  useDistributeShards,
  MIN_TRUST_CONTACTS_FOR_RECOVERY,
} from "@/lib/use-distribute-shards";
import { useTranslations } from "@/lib/i18n";

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
  const t = useTranslations("settingsSecurity");
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
            {t("redistribute.title")}
            <HelpHint content={t("redistribute.help")} />
          </h2>
          <p className="text-body-md text-on-surface-variant mt-1">
            {eligible.length === 0
              ? t("redistribute.statusNone")
              : belowMin
                ? t("redistribute.statusBelowMin")
                : t("redistribute.statusReady", {
                    count: eligible.length,
                    threshold,
                  })}
          </p>
        </div>
        <Button
          variant="vault"
          size="md"
          onClick={() => void distribute()}
          disabled={disabled}
          className="cursor-pointer shrink-0"
        >
          {status === "running"
            ? t("redistribute.distributing")
            : t("redistribute.distribute")}
        </Button>
      </div>

      {status === "ok" && (
        <p className="text-label-md text-secondary mt-2">
          {t("redistribute.success")}
        </p>
      )}
      {(status === "error" || status === "insufficient_contacts") && error && (
        <p className="text-label-md text-error mt-2">{error}</p>
      )}
      {status === "missing_master_key" && (
        <p className="text-label-md text-error mt-2">
          {t("redistribute.missingMasterKey")}
        </p>
      )}
    </section>
  );
}
