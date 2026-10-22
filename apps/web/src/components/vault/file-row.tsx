import type { ReactNode } from "react";
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Icon,
} from "@keeplas/ui";
import type { FileKind } from "@keeplas/backend/lib/vault_groups";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

export const FILE_ICON: Record<FileKind, string> = {
  document: ICON_PATHS.document,
  image: ICON_PATHS.photo,
  audio: ICON_PATHS.mic,
  video: ICON_PATHS.video,
};

/**
 * Figma "App/File row" (W06-3, W06-4, W06-5): kind tile, name, detail and
 * an optional ⋮ menu (`menu` = its DropdownMenuItems). With `onOpen` the
 * name opens the file.
 */
export function FileRow({
  kind,
  name,
  detail,
  menu,
  onOpen,
  className,
}: {
  kind: FileKind;
  name: string;
  detail: string;
  menu?: ReactNode;
  onOpen?: () => void;
  className?: string;
}) {
  const common = useTranslations("common");
  return (
    <div
      className={cn(
        "relative flex items-center gap-[12px] rounded-md border border-border-default bg-bg-surface px-[14px] py-[12px]",
        onOpen && "hover:bg-bg-subtle",
        className,
      )}
    >
      <span className="flex size-[40px] shrink-0 items-center justify-center rounded-sm bg-bg-accent text-action-primary">
        <Icon path={FILE_ICON[kind]} className="size-[20px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="truncate text-left text-[14px] leading-[20px] font-semibold text-text-primary after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-border-focus"
          >
            {name}
          </button>
        ) : (
          <span className="truncate text-[14px] leading-[20px] font-semibold text-text-primary">
            {name}
          </span>
        )}
        <span className="truncate text-body-sm text-text-muted">{detail}</span>
      </span>
      {menu ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={common("moreActions", { name })}
            className="relative -m-[4px] rounded-xs p-[4px] text-text-muted hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <Icon
              path={ICON_PATHS.more}
              strokeWidth={2.6}
              className="size-[18px]"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[160px] rounded-md border border-border-default bg-bg-surface p-[6px] shadow-menu"
          >
            {menu}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
