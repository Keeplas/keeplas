import { buttonVariants, cn, Icon } from "@keeplas/ui";
import { ShellPage } from "@/components/shell/shell-page";
import { Panel } from "@/components/v2/surface";
import { formatBytes } from "@/lib/format";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/navigation";

export interface StorageShare {
  label: string;
  bytes: number;
  /** Category color, e.g. "bg-category-document". */
  colorClassName: string;
}

export interface SettingsViewProps {
  usedBytes: number;
  quotaBytes: number;
  /** Used space by kind; empty when not known (bar shows the total). */
  breakdown: StorageShare[];
  plan: "free" | "lifetime";
  language: string;
  lifeCheck: string;
  notifications: string;
  onSignOut: () => void;
}

const ROW =
  "flex items-center justify-between gap-[12px] border-b border-border-default py-[14px] text-[15px] leading-[18px] last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus";

function ValueRow({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string;
}) {
  return (
    <Link href={href} className={cn(ROW, "hover:text-text-link")}>
      <span className="font-medium text-text-primary">{label}</span>
      <span className="text-text-muted">{value}</span>
    </Link>
  );
}

function NavRow({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={cn(ROW, "hover:text-text-link")}>
      <span className="font-medium text-text-primary">{label}</span>
      <Icon
        path={ICON_PATHS.chevronRight}
        className="size-[18px] text-icon-subtle"
      />
    </Link>
  );
}

/** W04-7 Settings: storage, plan, preferences; Recovery center and account. */
export function SettingsView({
  usedBytes,
  quotaBytes,
  breakdown,
  plan,
  language,
  lifeCheck,
  notifications,
  onSignOut,
}: SettingsViewProps) {
  const t = useTranslations("settings.overview");
  const percent = (bytes: number) =>
    `${Math.min(100, (bytes / quotaBytes) * 100)}%`;

  return (
    <ShellPage title={t("title")} subtitle={t("subtitle")}>
      <div className="grid items-start gap-[20px] lg:grid-cols-[minmax(0,1fr)_420px]">
        <Panel className="flex flex-col gap-[16px] p-[24px]">
          <h2 className="text-[19px] leading-[23px] font-semibold text-text-primary">
            {t("storage.title")}
          </h2>
          <p className="flex items-baseline gap-[8px]">
            <span className="font-serif text-[30px] leading-[41px] font-semibold text-text-primary">
              {formatBytes(usedBytes)}
            </span>
            <span className="text-[17px] leading-[21px] text-text-muted">
              {t("storage.of", { quota: formatBytes(quotaBytes) })}
            </span>
          </p>
          <div
            role="meter"
            aria-label={t("storage.title")}
            aria-valuemin={0}
            aria-valuemax={quotaBytes}
            aria-valuenow={usedBytes}
            className="flex h-[12px] gap-[2px] overflow-hidden rounded-[6px] bg-progress-track"
          >
            {breakdown.length > 0 ? (
              breakdown.map((share) => (
                <span
                  key={share.label}
                  className={share.colorClassName}
                  style={{ width: percent(share.bytes) }}
                />
              ))
            ) : (
              <span
                className="bg-progress-fill"
                style={{ width: percent(usedBytes) }}
              />
            )}
          </div>
          {breakdown.length > 0 ? (
            <ul className="grid grid-cols-2 gap-[12px] md:grid-cols-4">
              {breakdown.map((share) => (
                <li
                  key={share.label}
                  className="flex flex-col gap-[4px] rounded-[12px] bg-bg-subtle px-[14px] py-[12px]"
                >
                  <span className="flex items-center gap-[8px] text-[13px] leading-[16px] text-text-muted">
                    <span
                      className={cn(
                        "size-[8px] rounded-full",
                        share.colorClassName,
                      )}
                    />
                    {share.label}
                  </span>
                  <span className="text-[17px] leading-[21px] font-semibold text-text-primary">
                    {formatBytes(share.bytes)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-[13px] leading-[16px] text-text-muted">
            {t("storage.note")}
          </p>
        </Panel>

        <div className="flex flex-col gap-[16px]">
          <Panel className="flex flex-col gap-[12px] p-[24px]">
            <p className="text-[12px] leading-[15px] font-semibold text-text-muted uppercase">
              {t("plan.label")}
            </p>
            <p className="text-[19px] leading-[23px] font-semibold text-text-primary">
              {t(`plan.${plan}.name`)}
            </p>
            <p className="text-[15px] leading-[18px] text-text-body">
              {t(`plan.${plan}.summary`)}
            </p>
            {plan === "free" ? (
              <>
                <Link
                  href="/settings/subscription"
                  className={cn(
                    buttonVariants({ variant: "primary", size: "cta" }),
                    "w-full",
                  )}
                >
                  {t("plan.upgrade")}
                  <Icon
                    path={ICON_PATHS.chevronRight}
                    className="size-[20px]"
                  />
                </Link>
                <p className="text-center text-[13px] leading-[16px] text-text-muted">
                  {t("plan.upgradeNote")}
                </p>
              </>
            ) : null}
          </Panel>

          <Panel className="flex flex-col px-[24px] py-[8px]">
            <ValueRow
              href="/settings/preferences"
              label={t("preferences.language")}
              value={language}
            />
            <ValueRow
              href="/life-check"
              label={t("preferences.lifeCheck")}
              value={lifeCheck}
            />
            <ValueRow
              href="/settings/preferences"
              label={t("preferences.notifications")}
              value={notifications}
            />
          </Panel>

          <Panel className="flex flex-col px-[24px] py-[8px]">
            <NavRow
              href="/settings/recovery"
              label={t("more.recoveryCenter")}
            />
            <NavRow href="/settings/account" label={t("more.account")} />
            <NavRow href="/settings/contact" label={t("more.contact")} />
            <NavRow href="/settings/roadmap" label={t("more.roadmap")} />
            <button
              type="button"
              onClick={onSignOut}
              className={cn(ROW, "font-medium text-action-danger")}
            >
              {t("more.signOut")}
            </button>
          </Panel>
        </div>
      </div>
    </ShellPage>
  );
}
