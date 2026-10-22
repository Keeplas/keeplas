import { cn, Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import type { ItemStyle } from "@/lib/vault-list";

/** Tile tint, icon color and dot of each item style (category tokens). */
const VISUAL: Record<ItemStyle, { icon: string; tile: string; dot: string }> = {
  documents: {
    icon: ICON_PATHS.document,
    tile: "bg-category-document/12 text-category-document",
    dot: "bg-category-document",
  },
  accounts: {
    icon: ICON_PATHS.userCircle,
    tile: "bg-category-account/12 text-category-account",
    dot: "bg-category-account",
  },
  instructions: {
    icon: ICON_PATHS.document,
    tile: "bg-category-instruction/12 text-category-instruction",
    dot: "bg-category-instruction",
  },
  notes: {
    icon: ICON_PATHS.note,
    tile: "bg-category-note/12 text-category-note",
    dot: "bg-category-note",
  },
  photos: {
    icon: ICON_PATHS.photo,
    tile: "bg-category-other/12 text-category-other",
    dot: "bg-category-other",
  },
  voice: {
    icon: ICON_PATHS.mic,
    tile: "bg-category-note/12 text-category-note",
    dot: "bg-category-note",
  },
  videos: {
    icon: ICON_PATHS.video,
    tile: "bg-category-other/12 text-category-other",
    dot: "bg-category-other",
  },
};

/** Figma list "Tile": 36 px, radius 10, category tint at 12 %, icon 18. */
export function ItemTile({
  style,
  className,
}: {
  style: ItemStyle;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-[36px] shrink-0 items-center justify-center rounded-sm",
        VISUAL[style].tile,
        className,
      )}
    >
      <Icon path={VISUAL[style].icon} className="size-[18px]" />
    </span>
  );
}

/** Figma category dot: 8 px, the category color. */
export function CategoryDot({ style }: { style: ItemStyle }) {
  return (
    <span
      className={cn("size-[8px] shrink-0 rounded-full", VISUAL[style].dot)}
    />
  );
}
