import { Link } from "@/lib/navigation";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { buttonVariants, Icon, Loader, Progress } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

const FILE_KINDS: Array<{ kind: string; iconPath: string }> = [
  { kind: "document", iconPath: ICON_PATHS.description },
  { kind: "image", iconPath: ICON_PATHS.image },
  { kind: "audio", iconPath: ICON_PATHS.mic },
  { kind: "video", iconPath: ICON_PATHS.videocam },
];

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);
  const decimals = exponent === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[exponent]}`;
}

export default function SettingsUsagePage() {
  const t = useTranslations("settings");
  const stats = useQuery(api.vaults.getUsageStats);

  if (stats === undefined) return <Loader />;
  if (stats === null) return null;

  const usedPercent = Math.min(
    100,
    Math.round((stats.storageBytes / stats.quotaBytes) * 100),
  );
  const isNearLimit = usedPercent >= 80;
  const remainingBytes = Math.max(0, stats.quotaBytes - stats.storageBytes);
  const quotaLabel = formatBytes(stats.quotaBytes);
  const planName =
    stats.plan === "lifetime"
      ? t("usage.planNameLifetime")
      : t("usage.planNameFree");

  const categoryEntries = Object.entries(stats.categoryCounts).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-headline-md text-primary">{t("usage.title")}</h1>
        <p className="text-body-md text-on-surface-variant max-w-2xl">
          {t("usage.description")}
        </p>
      </header>

      <section className="bg-surface-container-low rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-label-md text-secondary">
              {t("usage.encryptedStorage")}
            </p>
            <p className="text-headline-md text-on-surface">
              {formatBytes(stats.storageBytes)}
              <span className="text-body-md text-on-surface-variant ml-2">
                {t("usage.ofQuota", { quota: quotaLabel })}
              </span>
            </p>
            <p className="text-body-md text-on-surface-variant">
              {t("usage.remainingPrefix", {
                amount: formatBytes(remainingBytes),
              })}{" "}
              <span className="font-medium text-on-surface">{planName}</span>{" "}
              {t("usage.remainingSuffix")}
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
            {t("usage.percentUsed", { percent: usedPercent })}
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
                {t("usage.nearLimit")}
              </p>
              <Link
                href="/settings/subscription"
                className={buttonVariants({ variant: "vault", size: "sm" })}
              >
                {t("usage.upgradePlan")}
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <UsageStatCard
          label={t("usage.cards.activeItems.label")}
          value={stats.activeItemsCount.toLocaleString()}
          iconPath={ICON_PATHS.description}
          hint={t("usage.cards.activeItems.hint")}
        />
        <UsageStatCard
          label={t("usage.cards.encryptedFiles.label")}
          value={stats.fileCount.toLocaleString()}
          iconPath={ICON_PATHS.cloud}
          hint={t("usage.cards.encryptedFiles.hint")}
        />
        <UsageStatCard
          label={t("usage.cards.categoriesUsed.label")}
          value={categoryEntries.length.toString()}
          iconPath={ICON_PATHS.accountTree}
          hint={t("usage.cards.categoriesUsed.hint")}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-headline-sm text-primary">
              {t("usage.itemsByCategory")}
            </h2>
            <span className="text-label-md text-on-surface-variant">
              {t("usage.total", { count: stats.activeItemsCount })}
            </span>
          </div>
          {categoryEntries.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">
              {t("usage.noItems")}
            </p>
          ) : (
            <ul className="space-y-2">
              {categoryEntries.map(([category, count]) => (
                <li
                  key={category}
                  className="flex items-center justify-between py-1.5"
                >
                  <span className="text-body-md text-on-surface">
                    {t(`usage.categories.${category}`)}
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
            <h2 className="text-headline-sm text-primary">
              {t("usage.filesByType")}
            </h2>
            <span className="text-label-md text-on-surface-variant">
              {t("usage.total", { count: stats.fileCount })}
            </span>
          </div>
          {stats.fileCount === 0 ? (
            <p className="text-body-md text-on-surface-variant">
              {t("usage.noFiles")}
            </p>
          ) : (
            <ul className="space-y-2">
              {FILE_KINDS.map((meta) => {
                const count = stats.fileKindCounts[meta.kind] ?? 0;
                return (
                  <li
                    key={meta.kind}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="flex items-center gap-2 text-body-md text-on-surface">
                      <Icon
                        path={meta.iconPath}
                        className="w-4 h-4 text-on-surface-variant"
                      />
                      {t(`usage.fileKinds.${meta.kind}`)}
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
          <h2 className="text-headline-sm text-primary">
            {t("usage.needCapacity.title")}
          </h2>
          <p className="text-body-md text-on-surface-variant max-w-xl">
            {t("usage.needCapacity.description")}
          </p>
        </div>
        <Link
          href="/settings/subscription"
          className={buttonVariants({ variant: "vault", size: "md" })}
        >
          {t("usage.comparePlans")}
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
