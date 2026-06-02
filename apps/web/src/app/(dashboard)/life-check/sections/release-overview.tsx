import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Loader } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";

const ROLE_KEYS = ["family", "friend", "lawyer", "doctor", "other"] as const;

/**
 * Owner-facing "who receives what" overview. Shows, per trusted contact, the
 * vault items they would get (and at what access level) if the Life Check is
 * confirmed — so the user can always see the outcome before it happens.
 */
export function ReleaseOverview() {
  const t = useTranslations("lifeCheck");
  const preview = useQuery(api.release.getReleasePreview);

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
      <h3 className="text-headline-sm text-primary mb-1.5">
        {t("overview.title")}
      </h3>
      <p className="text-body-md text-on-surface-variant mb-5">
        {t("overview.description")}
      </p>

      {preview === undefined ? (
        <Loader />
      ) : preview.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">
          {t("overview.empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {preview.map((r) => (
            <div
              key={r.contactId}
              className="flex items-start justify-between gap-4 p-4 bg-surface-container-low rounded-xl"
            >
              <div className="min-w-0">
                <p className="text-body-md font-bold text-primary">{r.name}</p>
                <p className="text-label-md text-on-surface-variant">
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
                </p>
                {r.itemTitles.length > 0 && (
                  <p className="text-label-md text-on-surface-variant/70 truncate mt-1">
                    {r.itemTitles.join(", ")}
                    {r.itemCount > r.itemTitles.length ? "…" : ""}
                  </p>
                )}
              </div>
              <span className="text-label-md px-3 py-1 rounded-full bg-secondary-container/30 text-secondary shrink-0">
                {t("overview.readOnly")}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
