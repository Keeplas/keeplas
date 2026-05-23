"use client";

import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Loader } from "@keeplas/ui";

const ROLE_LABELS: Record<string, string> = {
  family: "Family",
  friend: "Friend",
  lawyer: "Legal",
  doctor: "Medical",
  other: "Contact",
};

/**
 * Owner-facing "who receives what" overview. Shows, per trusted contact, the
 * vault items they would get (and at what access level) if the Life Check is
 * confirmed — so the user can always see the outcome before it happens.
 */
export function ReleaseOverview() {
  const preview = useQuery(api.release.getReleasePreview);

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
      <h3 className="text-headline-sm text-primary mb-1.5">Who receives what</h3>
      <p className="text-body-md text-on-surface-variant mb-5">
        If your Life Check is confirmed, each trusted contact gets read access to
        the items you&apos;ve shared with them.
      </p>

      {preview === undefined ? (
        <Loader />
      ) : preview.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">
          Nothing is set to release yet. Share vault items with your contacts to
          build your legacy.
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
                  {ROLE_LABELS[r.role] ?? "Contact"} · {r.itemCount} item
                  {r.itemCount === 1 ? "" : "s"}
                </p>
                {r.itemTitles.length > 0 && (
                  <p className="text-label-md text-on-surface-variant/70 truncate mt-1">
                    {r.itemTitles.join(", ")}
                    {r.itemCount > r.itemTitles.length ? "…" : ""}
                  </p>
                )}
              </div>
              <span className="text-label-md px-3 py-1 rounded-full bg-secondary-container/30 text-secondary shrink-0">
                Read-only
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
