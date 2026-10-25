import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

export interface ItemTableRow {
  id: string;
  name: string;
  /** Second and third columns (type / size, then date). */
  details: [string, string];
  onOpen: () => void;
  actions: Array<{ label: string; onSelect: () => void }>;
}

/**
 * Figma item table (W04-3 recent items, W04-4 shared files): subtle header,
 * one 53 px row per item, a "more" menu per row. `columns` is the grid
 * template: a flexible name column, the two detail columns, then the menu
 * column (its width keeps the trailing space of the design), as a Tailwind
 * `grid-cols-[…]` class.
 */
export function ItemTable({
  headers,
  columns,
  rows,
  iconClassName,
}: {
  headers: [string, string, string];
  columns: string;
  rows: ItemTableRow[];
  iconClassName: string;
}) {
  const t = useTranslations("common");
  const grid = cn("grid items-center px-[20px]", columns);
  return (
    <div className="overflow-x-auto rounded-[16px] border border-border-default bg-bg-surface">
      <div className="min-w-[720px]">
        <div
          className={cn(
            grid,
            "border-b border-border-default bg-bg-subtle py-[10px] text-caption text-text-muted",
          )}
        >
          {headers.map((header) => (
            <span key={header} className="py-[4px]">
              {header}
            </span>
          ))}
        </div>
        <ul>
          {rows.map((row) => (
            <li
              key={row.id}
              className={cn(
                grid,
                "relative border-b border-border-default py-[14px] text-body last:border-b-0 hover:bg-bg-subtle",
              )}
            >
              <button
                type="button"
                onClick={row.onOpen}
                className="flex min-h-[24px] min-w-0 items-center gap-[10px] pr-[16px] text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-border-focus"
              >
                <Icon
                  path={ICON_PATHS.document}
                  className={cn("size-[20px] shrink-0", iconClassName)}
                />
                <span className="truncate text-text-primary">{row.name}</span>
              </button>
              <span className="truncate text-text-body">{row.details[0]}</span>
              <span className="truncate text-text-body">{row.details[1]}</span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t("moreActions", { name: row.name })}
                  className="relative z-10 -m-[6px] w-fit rounded-xs p-[6px] text-icon-subtle hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  <Icon
                    path={ICON_PATHS.more}
                    strokeWidth={2.6}
                    className="size-[20px]"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[160px] rounded-md border border-border-default bg-bg-surface p-[6px] shadow-menu"
                >
                  {row.actions.map((action) => (
                    <DropdownMenuItem
                      key={action.label}
                      onSelect={action.onSelect}
                      className="rounded-sm px-[10px] py-[8px] text-body-sm text-text-primary focus:bg-bg-subtle"
                    >
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
