import { useId, type ReactNode } from "react";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  cn,
  Icon,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectItem,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { useCategoryLabel, useSortedCategories } from "@/lib/use-categories";
import type { FolderSummary } from "@/lib/vault-data";
import type { VaultCategory } from "@/lib/vault-categories";
import { ContactChecklist, useShareableContacts } from "./access-picker";

type ContactId = Id<"trusted_contacts">;
type FolderId = Id<"folders">;

const NO_FOLDER = "none";

/** Figma "App/Field": label (13/18) over its control, 6 px apart. */
export function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  /** Receives the id to give the control, for the label. */
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-[6px]", className)}>
      <label
        htmlFor={id}
        className="text-[13px] leading-[18px] font-medium text-text-body"
      >
        {label}
      </label>
      {children(id)}
    </div>
  );
}

/** Blue info box: shield and a line on encryption (W06-3 … W06-7). */
export function EncryptionNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-[10px] rounded-md bg-bg-info px-[14px] py-[12px] text-body-sm text-text-body">
      <Icon
        path={ICON_PATHS.shieldCheck}
        className="size-[18px] shrink-0 text-text-primary"
      />
      {children}
    </p>
  );
}

export function CategoryField({
  value,
  onChange,
  className,
}: {
  value: VaultCategory;
  onChange: (category: VaultCategory) => void;
  className?: string;
}) {
  const t = useTranslations("vaultItem.form");
  const label = useCategoryLabel();
  const categories = useSortedCategories();
  return (
    <Field label={t("category")} className={className}>
      {(id) => (
        <Select<VaultCategory>
          id={id}
          variant="field"
          value={value}
          onValueChange={onChange}
        >
          {categories.map((category) => (
            <SelectItem key={category.key} value={category.key}>
              {label(category.key)}
            </SelectItem>
          ))}
        </Select>
      )}
    </Field>
  );
}

export function FolderField({
  value,
  onChange,
  folders,
  className,
}: {
  value: FolderId | null;
  onChange: (folder: FolderId | null) => void;
  folders: FolderSummary[];
  className?: string;
}) {
  const t = useTranslations("vaultItem.form");
  const lists = useTranslations("vaultList");
  return (
    <Field label={t("folder")} className={className}>
      {(id) => (
        <Select<string>
          id={id}
          variant="field"
          value={value ?? NO_FOLDER}
          onValueChange={(next) =>
            onChange(next === NO_FOLDER ? null : (next as FolderId))
          }
        >
          <SelectItem value={NO_FOLDER}>{lists("noFolder")}</SelectItem>
          {folders.map((folder) => (
            <SelectItem key={folder.id} value={folder.id}>
              {folder.name ?? t("lockedFolder")}
            </SelectItem>
          ))}
        </Select>
      )}
    </Field>
  );
}

/** "Only you", "Sarah", "Sarah and Daniel", "Sarah, Daniel and 1 more". */
export function peopleSummary(
  names: string[],
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (names.length === 0) return t("onlyYou");
  if (names.length === 1) return names[0];
  if (names.length === 2)
    return t("two", { first: names[0], second: names[1] });
  return t("many", {
    first: names[0],
    second: names[1],
    count: names.length - 2,
  });
}

/**
 * "Who can see it": a select-like box that opens the contact checklist.
 * The folder's grantees can always see it (shown, locked).
 */
export function AccessField({
  value,
  onChange,
  folder,
  className,
}: {
  value: ContactId[];
  onChange: (contacts: ContactId[]) => void;
  /** The chosen folder: its grantees can see the item too. */
  folder: FolderSummary | undefined;
  className?: string;
}) {
  const t = useTranslations("vaultItem.form");
  const contacts = useShareableContacts();
  const inherited = (folder?.grants ?? []).map((grant) => ({
    contactId: grant.contactId,
    contactName: grant.contactName,
  }));
  const names = [
    ...inherited.map((grantee) => grantee.contactName),
    ...contacts
      .filter((contact) => value.includes(contact._id))
      .filter(
        (contact) =>
          !inherited.some((grantee) => grantee.contactId === contact._id),
      )
      .map((contact) => contact.name),
  ];
  return (
    <Field label={t("whoCanSee")} className={className}>
      {(id) => (
        <Popover>
          <PopoverTrigger
            id={id}
            className="flex h-[46px] w-full items-center gap-[8px] rounded-sm border border-border-default bg-bg-surface px-[14px] text-left text-[15px] leading-[22px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <span className="min-w-0 flex-1 truncate">
              {peopleSummary(names, t)}
            </span>
            <Icon
              path={ICON_PATHS.chevronDown}
              className="size-[18px] shrink-0 text-text-muted"
            />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[var(--radix-popover-trigger-width)] min-w-[280px] rounded-md border border-border-default bg-bg-surface p-[8px] shadow-menu"
          >
            <ContactChecklist
              selected={value}
              onChange={onChange}
              inherited={inherited}
              folderName={folder?.name ?? undefined}
            />
          </PopoverContent>
        </Popover>
      )}
    </Field>
  );
}
