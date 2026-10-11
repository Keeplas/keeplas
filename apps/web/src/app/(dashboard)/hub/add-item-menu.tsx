import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
} from "@keeplas/ui";
import { IconTile } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

export type AddKind = "document" | "photo" | "note" | "voice" | "video";

const KINDS: Array<{ kind: AddKind; icon: string }> = [
  { kind: "document", icon: ICON_PATHS.document },
  { kind: "photo", icon: ICON_PATHS.photo },
  { kind: "note", icon: ICON_PATHS.note },
  { kind: "voice", icon: ICON_PATHS.mic },
  { kind: "video", icon: ICON_PATHS.video },
];

function MenuRow({
  icon,
  title,
  description,
  onSelect,
}: {
  icon: string;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      className="group gap-[12px] rounded-sm px-[10px] py-[7px] focus:bg-bg-info"
    >
      <IconTile
        icon={icon}
        size={40}
        className="bg-bg-accent text-text-accent"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="text-label text-text-primary">{title}</span>
        <span className="text-body-sm whitespace-nowrap text-text-muted">
          {description}
        </span>
      </span>
      <Icon
        path={ICON_PATHS.chevronRight}
        className="hidden size-[18px] shrink-0 text-icon-subtle group-data-[highlighted]:block"
      />
    </DropdownMenuItem>
  );
}

/**
 * W04-3b "Add item" menu. Each kind opens the item editor; "Scan with my
 * phone" points to the app, where capture happens.
 */
export function AddItemMenu({
  onAdd,
  onScan,
  defaultOpen,
}: {
  onAdd: (kind: AddKind) => void;
  onScan: () => void;
  /** Visual tests render the menu open (W04-3b). */
  defaultOpen?: boolean;
}) {
  const t = useTranslations("hub.add");
  return (
    <DropdownMenu defaultOpen={defaultOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="primary"
          size="compact"
          className="data-[state=open]:ring-[3px] data-[state=open]:ring-border-strong"
        >
          <Icon path={ICON_PATHS.plus} className="size-[16px]" />
          {t("button")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-max min-w-[360px] rounded-[16px] border border-border-default bg-bg-surface px-[8px] pt-[10px] pb-[8px] shadow-menu"
      >
        <DropdownMenuLabel className="px-[10px] pt-[2px] pb-[6px] text-[12px] leading-[15px] font-semibold tracking-[0.06em] text-text-muted uppercase">
          {t("title")}
        </DropdownMenuLabel>
        {KINDS.map(({ kind, icon }) => (
          <MenuRow
            key={kind}
            icon={icon}
            title={t(`${kind}.title`)}
            description={t(`${kind}.description`)}
            onSelect={() => onAdd(kind)}
          />
        ))}
        <DropdownMenuSeparator className="my-[4px] bg-border-default" />
        <MenuRow
          icon={ICON_PATHS.qr}
          title={t("scan.title")}
          description={t("scan.description")}
          onSelect={onScan}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
