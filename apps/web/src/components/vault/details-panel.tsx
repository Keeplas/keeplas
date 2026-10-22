import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { cn, Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

export interface ActivityEntry {
  id: string;
  title: string;
  /** "Today, 10:12 AM". */
  when: string;
  actor: string;
}

/**
 * Figma "App/Detail row": icon, label, value, chevron; a button so it can
 * open the menu or dialog that changes the value.
 */
export const DetailRow = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button"> & {
    icon: string;
    label: string;
    value: string;
  }
>(({ icon, label, value, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "flex w-full items-center gap-[12px] border-b border-border-default py-[14px] text-left text-[14px] leading-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-default",
      className,
    )}
    {...props}
  >
    <Icon path={icon} className="size-[18px] shrink-0 text-text-muted" />
    <span className="min-w-0 flex-1 text-text-muted">{label}</span>
    <span className="truncate font-semibold text-text-primary">{value}</span>
    <Icon
      path={ICON_PATHS.chevronRight}
      className="size-[16px] shrink-0 text-text-subtle"
    />
  </button>
));
DetailRow.displayName = "DetailRow";

/**
 * W06-2 "Details" panel: the rows that organize the item (category, folder,
 * access: passed in so each opens its own picker), sharing, the encryption
 * note and the latest activity.
 */
export function DetailsPanel({
  rows,
  onEdit,
  onAddPeople,
  activity,
  onSeeAll,
}: {
  rows: ReactNode;
  onEdit?: () => void;
  onAddPeople?: () => void;
  activity: ActivityEntry[];
  onSeeAll: () => void;
}) {
  const t = useTranslations("vaultItem.details");
  return (
    <aside className="flex w-full flex-col gap-[14px] rounded-[20px] border border-border-default bg-bg-surface p-[20px] lg:w-[380px] lg:shrink-0">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 text-text-primary">{t("title")}</h2>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-[6px] rounded-xs text-[13px] leading-[18px] font-semibold text-text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <Icon path={ICON_PATHS.edit} className="size-[16px]" />
            {t("edit")}
          </button>
        ) : null}
      </div>

      <div className="flex flex-col">{rows}</div>

      {onAddPeople ? (
        <button
          type="button"
          onClick={onAddPeople}
          className="flex items-center gap-[12px] rounded-md bg-bg-info px-[14px] py-[12px] text-left hover:bg-bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <span className="flex size-[36px] shrink-0 items-center justify-center rounded-full bg-bg-surface text-text-primary">
            <Icon path={ICON_PATHS.userPlus} className="size-[18px]" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[14px] leading-[20px] font-semibold text-text-primary">
              {t("addPeople")}
            </span>
            <span className="text-[12px] leading-[16px] text-text-muted">
              {t("addPeopleBody")}
            </span>
          </span>
          <Icon
            path={ICON_PATHS.chevronRight}
            className="size-[16px] shrink-0 text-text-subtle"
          />
        </button>
      ) : null}

      <p className="flex gap-[10px] text-body-sm text-text-body">
        <Icon
          path={ICON_PATHS.shieldCheck}
          className="size-[18px] shrink-0 text-status-active"
        />
        {t("encrypted")}
      </p>

      <hr className="border-border-default" />

      <div className="flex items-center justify-between">
        <h3 className="text-[15px] leading-[20px] font-semibold text-text-primary">
          {t("activity")}
        </h3>
        <button
          type="button"
          onClick={onSeeAll}
          className="rounded-xs text-[13px] leading-[18px] font-semibold text-text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          {t("seeAll")}
        </button>
      </div>
      <ul className="flex flex-col">
        {activity.map((entry) => (
          <li key={entry.id} className="flex gap-[12px] py-[8px]">
            <span className="flex size-[20px] shrink-0 items-center justify-center">
              <span className="size-[10px] rounded-full bg-status-active" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <span className="truncate text-[14px] leading-[20px] font-semibold text-text-primary">
                {entry.title}
              </span>
              <span className="text-body-sm text-text-muted">{entry.when}</span>
            </span>
            <span className="text-body-sm text-text-muted">{entry.actor}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
