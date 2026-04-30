"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { buttonVariants, Icon, Loader, Progress } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

const STORAGE_QUOTA_BYTES = 100 * 1024 * 1024;
const CURRENT_PLAN_LABEL = "Free";
const CURRENT_PLAN_QUOTA_LABEL = "100 MB";

const CATEGORY_LABELS: Record<string, string> = {
  personal_document: "Personal Documents",
  financial_asset: "Financial Assets",
  digital_asset: "Digital Assets",
  health_directive: "Health Directives",
  legal_document: "Legal Documents",
  business_continuity: "Business Continuity",
  conditional_message: "Conditional Messages",
  credential: "Credentials",
};

const FILE_KIND_LABELS: Record<string, { label: string; iconPath: string }> = {
  document: { label: "Documents", iconPath: ICON_PATHS.description },
  image: { label: "Images", iconPath: ICON_PATHS.image },
  audio: { label: "Audio", iconPath: ICON_PATHS.mic },
  video: { label: "Video", iconPath: ICON_PATHS.videocam },
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / Math.pow(1024, exponent);
  const decimals = exponent === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[exponent]}`;
}

export default function SettingsUsagePage() {
  const stats = useQuery(api.vaults.getUsageStats);

  if (stats === undefined) return <Loader />;
  if (stats === null) return null;

  const usedPercent = Math.min(
    100,
    Math.round((stats.storageBytes / STORAGE_QUOTA_BYTES) * 100)
  );
  const isNearLimit = usedPercent >= 80;
  const remainingBytes = Math.max(0, STORAGE_QUOTA_BYTES - stats.storageBytes);

  const categoryEntries = Object.entries(stats.categoryCounts).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-headline-md text-primary">Resources & Usage</h1>
        <p className="text-body-md text-on-surface-variant max-w-2xl">
          Monitor the encrypted storage and items consumed by your vault. When
          you approach your plan&rsquo;s capacity, upgrade to keep adding items
          without interruption.
        </p>
      </header>

      <section className="bg-surface-container-low rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-label-md text-secondary">Encrypted Storage</p>
            <p className="text-headline-md text-on-surface">
              {formatBytes(stats.storageBytes)}
              <span className="text-body-md text-on-surface-variant ml-2">
                of {CURRENT_PLAN_QUOTA_LABEL}
              </span>
            </p>
            <p className="text-body-md text-on-surface-variant">
              {formatBytes(remainingBytes)} remaining on the{" "}
              <span className="font-medium text-on-surface">
                {CURRENT_PLAN_LABEL}
              </span>{" "}
              plan
            </p>
          </div>
          <span
            className={
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-label-md " +
              (isNearLimit
                ? "bg-error-container text-on-error-container"
                : "bg-secondary-container text-on-secondary-container")
            }
          >
            {usedPercent}% used
          </span>
        </div>

        <Progress value={usedPercent} />

        {isNearLimit && (
          <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/40 p-4">
            <Icon
              path={ICON_PATHS.warning}
              className="w-5 h-5 text-error shrink-0 mt-0.5"
            />
            <div className="space-y-2 flex-1">
              <p className="text-body-md text-on-error-container">
                You&rsquo;re close to your storage limit. Upgrade to Keeper for
                10 GB of encrypted capacity and additional continuity tools.
              </p>
              <Link
                href="/settings/subscription"
                className={buttonVariants({ variant: "vault", size: "sm" })}
              >
                Upgrade plan
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <UsageStatCard
          label="Active Items"
          value={stats.activeItemsCount.toLocaleString()}
          iconPath={ICON_PATHS.description}
          hint="Non-archived vault items"
        />
        <UsageStatCard
          label="Encrypted Files"
          value={stats.fileCount.toLocaleString()}
          iconPath={ICON_PATHS.cloud}
          hint="Blobs stored in your vault"
        />
        <UsageStatCard
          label="Categories Used"
          value={categoryEntries.length.toString()}
          iconPath={ICON_PATHS.accountTree}
          hint="Distinct categories populated"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-headline-sm text-primary">Items by Category</h2>
            <span className="text-label-md text-on-surface-variant">
              {stats.activeItemsCount} total
            </span>
          </div>
          {categoryEntries.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">
              No items yet. Start building your vault from the Hub.
            </p>
          ) : (
            <ul className="space-y-2">
              {categoryEntries.map(([category, count]) => (
                <li
                  key={category}
                  className="flex items-center justify-between py-1.5"
                >
                  <span className="text-body-md text-on-surface">
                    {CATEGORY_LABELS[category] ?? category}
                  </span>
                  <span className="text-label-md text-on-surface-variant">
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-headline-sm text-primary">Files by Type</h2>
            <span className="text-label-md text-on-surface-variant">
              {stats.fileCount} total
            </span>
          </div>
          {stats.fileCount === 0 ? (
            <p className="text-body-md text-on-surface-variant">
              No encrypted files attached yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(FILE_KIND_LABELS).map(([kind, meta]) => {
                const count = stats.fileKindCounts[kind] ?? 0;
                return (
                  <li
                    key={kind}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="flex items-center gap-2 text-body-md text-on-surface">
                      <Icon
                        path={meta.iconPath}
                        className="w-4 h-4 text-on-surface-variant"
                      />
                      {meta.label}
                    </span>
                    <span className="text-label-md text-on-surface-variant">
                      {count}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-surface-container-low p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <div className="space-y-1">
          <h2 className="text-headline-sm text-primary">Need more capacity?</h2>
          <p className="text-body-md text-on-surface-variant max-w-xl">
            Keeper unlocks 10 GB of zero-knowledge storage, video legacy
            messages, and the full scenario engine. Lifetime gets it all
            forever in a single payment.
          </p>
        </div>
        <Link
          href="/settings/subscription"
          className={buttonVariants({ variant: "vault", size: "md" })}
        >
          Compare plans
        </Link>
      </section>
    </div>
  );
}

function UsageStatCard({
  label,
  value,
  iconPath,
  hint,
}: {
  label: string;
  value: string;
  iconPath: string;
  hint: string;
}) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-5 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-label-md text-secondary">{label}</p>
        <Icon path={iconPath} className="w-4 h-4 text-on-surface-variant" />
      </div>
      <p className="text-headline-md text-on-surface">{value}</p>
      <p className="text-label-md text-on-surface-variant">{hint}</p>
    </div>
  );
}
