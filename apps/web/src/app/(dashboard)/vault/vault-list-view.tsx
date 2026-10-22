import { useRef, useState, type DragEvent, type ReactNode } from "react";
import type { VaultListKey } from "@keeplas/backend/lib/vault_groups";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Icon,
} from "@keeplas/ui";
import { ShellPage } from "@/components/shell/shell-page";
import { AddItemMenu, type AddKind } from "@/components/vault/add-item-menu";
import { CategoryDot, ItemTile } from "@/components/vault/item-visual";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/navigation";
import type { ItemStyle, VaultSort } from "@/lib/vault-list";

export interface VaultListRow {
  id: string;
  title: string;
  /** "PDF · 2.4 MB", "Voice note · 0:28", "Note · 3 attachments". */
  detail: string;
  style: ItemStyle;
  category: string;
  folder: string | null;
  access: { icon: "lock" | "user" | "people"; label: string };
  updated: string;
}

export interface VaultListViewProps {
  list: VaultListKey;
  counts: Record<VaultListKey, number>;
  /** undefined while the vault is still opening. */
  rows: VaultListRow[] | undefined;
  search: string;
  sort: VaultSort;
  onList: (list: VaultListKey) => void;
  onSearch: (search: string) => void;
  onSort: (sort: VaultSort) => void;
  onArchive: (id: string) => void;
  onFiles: (files: File[]) => void;
  onAdd: (kind: AddKind) => void;
  onScan: () => void;
  /** Empty vault: the shared "Your vault is empty" message. */
  empty: ReactNode;
}

// Chips in Figma order; a list shows when it holds items (or is selected).
const LISTS: VaultListKey[] = [
  "all",
  "inbox",
  "documents",
  "accounts",
  "instructions",
  "notes",
  "photos",
  "voice",
  "videos",
  "other",
];

const SORTS: VaultSort[] = ["updated", "name", "added"];

// Name, Category, Folder, Shared with, Updated, menu (W06-1 cells).
const COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_190px_150px_150px_104px_20px] items-center px-[20px]";

const ACCESS_ICON = {
  lock: ICON_PATHS.lock,
  user: ICON_PATHS.user,
  people: ICON_PATHS.people,
};

function Cell({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-[8px] pr-[12px] text-[14px] leading-[20px] text-text-body">
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

function Row({
  row,
  onArchive,
}: {
  row: VaultListRow;
  onArchive: (id: string) => void;
}) {
  const t = useTranslations("vaultList");
  const common = useTranslations("common");
  const href = `/vault/${row.id}`;
  return (
    <li
      className={cn(
        COLUMNS,
        "relative border-t border-border-default py-[10px] hover:bg-bg-info has-[a:focus-visible]:bg-bg-info",
      )}
    >
      <span className="flex min-w-0 items-center gap-[12px] pr-[12px]">
        <ItemTile style={row.style} />
        <span className="flex min-w-0 flex-col">
          {/* The link covers the row; the menu sits above it. */}
          <Link
            href={href}
            className="truncate text-[14px] leading-[20px] font-semibold text-text-primary after:absolute after:inset-0 focus-visible:outline-none"
          >
            {row.title}
          </Link>
          <span className="truncate text-[12px] leading-[16px] text-text-muted">
            {row.detail}
          </span>
        </span>
      </span>
      <Cell icon={<CategoryDot style={row.style} />}>{row.category}</Cell>
      <Cell
        icon={
          <Icon
            path={ICON_PATHS.folder}
            className="size-[16px] shrink-0 text-icon-default"
          />
        }
      >
        {row.folder ?? t("noFolder")}
      </Cell>
      <Cell
        icon={
          <Icon
            path={ACCESS_ICON[row.access.icon]}
            className="size-[16px] shrink-0 text-icon-default"
          />
        }
      >
        {row.access.label}
      </Cell>
      <span className="truncate text-[14px] leading-[20px] text-text-muted">
        {row.updated}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={common("moreActions", { name: row.title })}
          className="relative -m-[6px] w-fit rounded-xs p-[6px] text-icon-subtle hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
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
          <DropdownMenuItem
            asChild
            className="rounded-sm px-[10px] py-[8px] text-body-sm text-text-primary focus:bg-bg-subtle"
          >
            <Link href={href}>{t("actions.open")}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onArchive(row.id)}
            className="rounded-sm px-[10px] py-[8px] text-body-sm text-action-danger focus:bg-bg-danger"
          >
            {t("actions.archive")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/** W06-1 My vault: search, sort, list chips, the item table, drop to add. */
export function VaultListView({
  list,
  counts,
  rows,
  search,
  sort,
  onList,
  onSearch,
  onSort,
  onArchive,
  onFiles,
  onAdd,
  onScan,
  empty,
}: VaultListViewProps) {
  const t = useTranslations("vaultList");
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const count = rows?.length ?? 0;

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }

  return (
    <div
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setDragging(false);
        }
      }}
      onDrop={drop}
    >
      <ShellPage
        breadcrumb={[
          { label: t("breadcrumb"), href: "/hub" },
          { label: t(`lists.${list}`) },
        ]}
        title={t(`lists.${list}`)}
        subtitle={count === 1 ? t("subtitleOne") : t("subtitle", { count })}
      >
        {/* The frame spaces this block 16 px from the header, not 20. */}
        <div className="-mt-[4px] flex flex-col gap-[16px]">
          <div className="flex flex-wrap items-center gap-[12px]">
            <label className="flex h-[42px] w-[380px] max-w-full items-center gap-[10px] rounded-sm border border-border-default bg-bg-surface px-[14px] focus-within:ring-2 focus-within:ring-border-focus">
              <Icon
                path={ICON_PATHS.search}
                className="size-[18px] shrink-0 text-icon-subtle"
              />
              <span className="sr-only">{t("search")}</span>
              <input
                type="search"
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                placeholder={t("search")}
                className="min-w-0 flex-1 bg-transparent text-[14px] leading-[20px] text-text-primary placeholder:text-text-subtle focus:outline-none"
              />
            </label>
            <span className="flex-1" />
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-[6px] rounded-xs text-[13px] leading-[18px] font-medium text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                {t("sort.label", { sort: t(`sort.${sort}`) })}
                <Icon
                  path={ICON_PATHS.chevronDown}
                  className="size-[16px] text-icon-default"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[180px] rounded-md border border-border-default bg-bg-surface p-[6px] shadow-menu"
              >
                <DropdownMenuRadioGroup
                  value={sort}
                  onValueChange={(value) => onSort(value as VaultSort)}
                >
                  {SORTS.map((option) => (
                    <DropdownMenuRadioItem
                      key={option}
                      value={option}
                      className="rounded-sm py-[8px] text-body-sm text-text-primary focus:bg-bg-subtle"
                    >
                      {t(`sort.${option}`)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              ref={fileInput}
              type="file"
              multiple
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (files.length > 0) onFiles(files);
              }}
            />
            <Button
              variant="bordered"
              size="regular"
              onClick={() => fileInput.current?.click()}
            >
              <Icon path={ICON_PATHS.cloudUpload} className="size-[16px]" />
              {t("upload")}
            </Button>
            <AddItemMenu size="regular" onAdd={onAdd} onScan={onScan} />
          </div>

          <div
            role="group"
            aria-label={t("listsLabel")}
            className="flex flex-wrap items-center gap-[8px]"
          >
            {LISTS.filter(
              (key) => key === "all" || key === list || counts[key] > 0,
            ).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={key === list}
                onClick={() => onList(key)}
                className={cn(
                  "rounded-full px-[14px] py-[7px] text-[13px] leading-[18px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
                  key === list
                    ? "bg-action-primary text-text-inverse"
                    : "border border-border-default bg-bg-surface text-text-body hover:bg-bg-subtle",
                )}
              >
                {key === "all"
                  ? t("lists.all")
                  : `${t(`lists.${key}`)} ${counts[key]}`}
              </button>
            ))}
          </div>

          {counts.all === 0 && rows ? (
            <div className="flex justify-center rounded-[20px] border border-border-default bg-bg-surface">
              {empty}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[20px] border border-border-default bg-bg-surface">
              <div className="min-w-[900px]">
                <div
                  className={cn(
                    COLUMNS,
                    "h-[44px] bg-bg-subtle text-caption text-text-muted",
                  )}
                >
                  <span>{t("columns.name")}</span>
                  <span>{t("columns.category")}</span>
                  <span>{t("columns.folder")}</span>
                  <span>{t("columns.sharedWith")}</span>
                  <span>{t(`columns.${sort}`)}</span>
                </div>
                {rows === undefined ? (
                  <p className="border-t border-border-default px-[20px] py-[18px] text-body-sm text-text-muted">
                    {t("loading")}
                  </p>
                ) : rows.length === 0 ? (
                  <p className="border-t border-border-default px-[20px] py-[18px] text-body-sm text-text-muted">
                    {search.trim()
                      ? t("noMatch", { search: search.trim() })
                      : t("emptyList")}
                  </p>
                ) : (
                  <ul>
                    {rows.map((row) => (
                      <Row key={row.id} row={row} onArchive={onArchive} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div
            className={cn(
              "flex items-center justify-center gap-[12px] rounded-[20px] border-[1.5px] border-dashed px-[20px] py-[16px] text-[14px] leading-[20px] text-text-muted",
              dragging
                ? "border-border-focus bg-bg-info"
                : "border-border-strong",
            )}
          >
            <Icon
              path={ICON_PATHS.cloudUpload}
              className="size-[20px] shrink-0 text-icon-default"
            />
            {t("dropHint")}
          </div>
        </div>
      </ShellPage>
    </div>
  );
}
