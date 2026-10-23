import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Loader } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";
import { useDecryptedTitles } from "@/lib/use-decrypted-titles";
import { Panel, RowText, StatusChip } from "@/components/v2/surface";

const ROLE_KEYS = ["family", "friend", "lawyer", "doctor", "other"] as const;

/**
 * Owner-facing "who receives what" overview. Shows, per trusted contact, the
 * vault items they would get (and at what access level) if the Life Check is
 * confirmed — so the user can always see the outcome before it happens.
 */
export function ReleaseOverview() {
  const t = useTranslations("lifeCheck");
  const preview = useQuery(api.release.getReleasePreview);
  // Flatten the per-contact title lists into one decrypt pass (the cache keys on
  // _id + ciphertext, so an item shared with several contacts decrypts once).
  const allTitles = useMemo(
    () => (preview ?? []).flatMap((r) => r.itemTitles),
    [preview],
  );
  const titles = useDecryptedTitles(allTitles);

  return (
    <Panel className="flex flex-col gap-[16px] p-[20px]">
      <div className="flex flex-col gap-[4px]">
        <h2 className="text-h3 text-text-primary">{t("overview.title")}</h2>
        <p className="text-body-sm text-text-muted">
          {t("overview.description")}
        </p>
      </div>

      {preview === undefined ? (
        <Loader size="sm" className="min-h-0" />
      ) : preview.length === 0 ? (
        <p className="text-body-sm text-text-muted">{t("overview.empty")}</p>
      ) : (
        <div className="flex flex-col gap-[16px]">
          {preview.map((r) => (
            <div key={r.contactId} className="flex items-start gap-[12px]">
              <RowText
                title={r.name}
                description={
                  <>
                    {(ROLE_KEYS as readonly string[]).includes(r.role)
                      ? t(`overview.role.${r.role}`)
                      : t("overview.role.other")}{" "}
                    ·{" "}
                    {t(
                      r.itemCount === 1
                        ? "overview.itemCountSingular"
                        : "overview.itemCountPlural",
                      { count: r.itemCount },
                    )}
                    {r.itemTitles.length > 0 && (
                      <span className="mt-[2px] block truncate text-text-subtle">
                        {r.itemTitles
                          .map((it) => titles[it._id] ?? "")
                          .filter(Boolean)
                          .join(", ")}
                        {r.itemCount > r.itemTitles.length ? "…" : ""}
                      </span>
                    )}
                  </>
                }
              />
              <StatusChip tone="neutral" label={t("overview.readOnly")} />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
