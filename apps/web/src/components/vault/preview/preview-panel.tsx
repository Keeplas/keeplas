import type { ReactNode } from "react";
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Icon,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

const ICON_BUTTON =
  "flex size-[26px] items-center justify-center rounded-xs text-text-muted hover:bg-bg-surface hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-40 disabled:hover:bg-transparent";

/** An 18 px toolbar action (rotate, hide, previous / next). */
export function ToolbarButton({
  icon,
  label,
  onClick,
  disabled,
  pressed,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(ICON_BUTTON, "-m-[4px]")}
    >
      <Icon path={icon} className="size-[18px]" />
    </button>
  );
}

/** "‹ Page 1 of 3 ›": previous and next around a label. */
export function Pager({
  label,
  onPrevious,
  onNext,
}: {
  label: string;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const t = useTranslations("vaultItem.preview");
  return (
    <div className="flex items-center gap-[8px]">
      <ToolbarButton
        icon={ICON_PATHS.chevronLeft}
        label={t("previous")}
        onClick={() => onPrevious?.()}
        disabled={!onPrevious}
      />
      <span className="text-[13px] leading-[18px] font-medium text-text-body">
        {label}
      </span>
      <ToolbarButton
        icon={ICON_PATHS.chevronRight}
        label={t("next")}
        onClick={() => onNext?.()}
        disabled={!onNext}
      />
    </div>
  );
}

export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/** Figma "Zoom": − 100 % + in a bordered box. */
export function ZoomControl({
  zoom,
  onZoom,
}: {
  zoom: number;
  onZoom: (zoom: number) => void;
}) {
  const t = useTranslations("vaultItem.preview");
  const index = ZOOM_STEPS.indexOf(zoom);
  const step = (delta: number) =>
    onZoom(
      ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, index + delta))],
    );
  const button =
    "w-[10px] text-[15px] leading-[20px] font-medium text-text-body hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-40";
  return (
    <div className="flex items-center gap-[10px] rounded-sm border border-border-default bg-bg-surface px-[10px] py-[5px]">
      <button
        type="button"
        aria-label={t("zoomOut")}
        className={button}
        onClick={() => step(-1)}
        disabled={index <= 0}
      >
        −
      </button>
      <span className="w-[34px] text-center text-[13px] leading-[18px] font-medium text-text-body tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        aria-label={t("zoomIn")}
        className={button}
        onClick={() => step(1)}
        disabled={index >= ZOOM_STEPS.length - 1}
      >
        +
      </button>
    </div>
  );
}

/**
 * W06-2 / W06-8 / W06-9 "Preview" card: the toolbar (`start`, then `tools`,
 * hide and the item menu), the preview itself, blurred while hidden.
 */
export function PreviewPanel({
  start,
  tools,
  hidden,
  onToggleHidden,
  menu,
  children,
}: {
  start: ReactNode;
  tools?: ReactNode;
  hidden: boolean;
  onToggleHidden: () => void;
  /** DropdownMenuItems of the ⋮ menu. */
  menu: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("vaultItem.preview");
  const common = useTranslations("common");
  return (
    <section className="flex min-h-[713px] min-w-0 flex-1 flex-col gap-[16px] rounded-[20px] border border-border-default bg-bg-subtle px-[20px] pt-[16px] pb-[20px]">
      <div className="flex min-h-[18px] items-center gap-[16px]">
        {start}
        <span className="flex-1" />
        {tools}
        <ToolbarButton
          icon={hidden ? ICON_PATHS.eyeOff : ICON_PATHS.eye}
          label={hidden ? t("show") : t("hide")}
          pressed={hidden}
          onClick={onToggleHidden}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={common("moreActions", { name: t("item") })}
            className={cn(ICON_BUTTON, "-m-[4px]")}
          >
            <Icon
              path={ICON_PATHS.more}
              strokeWidth={2.6}
              className="size-[18px]"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[180px] rounded-md border border-border-default bg-bg-surface p-[6px] shadow-menu"
          >
            {menu}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col transition-[filter]",
          hidden && "pointer-events-none blur-xl select-none",
        )}
        aria-hidden={hidden}
      >
        {children}
      </div>
    </section>
  );
}
