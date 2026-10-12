import type { HTMLAttributes, ReactNode } from "react";
import { cn, Icon } from "@keeplas/ui";

/** Figma card frame on the web screens: surface, 1 px border, radius 16. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "rounded-[16px] border border-border-default bg-bg-surface",
        className,
      )}
      {...props}
    />
  );
}

/** Round icon tile (Figma "Tile"): 40, 44 or 48 px, icon 20 to 24 px. */
export function IconTile({
  icon,
  size = 44,
  className,
  iconClassName,
}: {
  icon: string;
  size?: 40 | 44 | 48;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        size === 40 && "size-[40px]",
        size === 44 && "size-[44px]",
        size === 48 && "size-[48px]",
        className,
      )}
    >
      <Icon
        path={icon}
        className={cn(
          size === 40 && "size-[20px]",
          size === 44 && "size-[22px]",
          size === 48 && "size-[24px]",
          iconClassName,
        )}
      />
    </span>
  );
}

/** Title (label) over a muted description, the text block of most rows. */
export function RowText({
  title,
  description,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 flex-1 flex-col gap-[2px]", className)}>
      <span className="text-label text-text-primary">{title}</span>
      {description ? (
        <span className="text-body-sm text-text-muted">{description}</span>
      ) : null}
    </span>
  );
}

const CHIP_TONE = {
  pending: "bg-bg-pending text-text-pending",
  neutral: "bg-bg-subtle text-text-primary",
} as const;

/** Figma "Status Chip": pill, caption text, optional status dot. */
export function StatusChip({
  label,
  tone,
  dotClassName,
}: {
  label: string;
  tone: keyof typeof CHIP_TONE;
  dotClassName?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-[6px] rounded-full px-[10px] py-[4px] text-caption",
        CHIP_TONE[tone],
      )}
    >
      {dotClassName ? (
        <span className={cn("size-[8px] rounded-full", dotClassName)} />
      ) : null}
      {label}
    </span>
  );
}
