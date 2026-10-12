import { cn, Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { Link } from "@/lib/navigation";
import { IconTile, RowText } from "./surface";

/**
 * Figma "List Row" card: icon tile, title, description, chevron. 68 px tall;
 * a two-line description keeps the height by using 4 px vertical padding.
 */
export function ListRow({
  href,
  icon,
  title,
  description,
  className,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[68px] items-center gap-[14px] rounded-md border border-border-default bg-bg-surface px-[14px] py-[4px] transition-colors hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
        className,
      )}
    >
      <IconTile
        icon={icon}
        className="bg-bg-info text-text-link"
        iconClassName="size-[24px]"
      />
      <RowText title={title} description={description} />
      <Icon
        path={ICON_PATHS.chevronRight}
        className="size-[20px] shrink-0 text-icon-subtle"
      />
    </Link>
  );
}
