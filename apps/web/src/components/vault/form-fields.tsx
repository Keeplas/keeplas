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
import { shownFiling } from "@keeplas/backend/lib/vault_groups";
import {
  choiceKey,
  choiceOf,
  CUSTOM_FALLBACK,
  type CategoryChoice,
} from "@/lib/item-meta";
import {
  useCategoryLabel,
  useHiddenCategoryGroups,
  useSortedCategories,
} from "@/lib/use-categories";
import type { CategorySummary } from "@/lib/vault-data";
import { ContactChecklist, useShareableContacts } from "./access-picker";

type ContactId = Id<"trusted_contacts">;

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

/**
 * Category select: the built-in categories the user kept, then their own
 * (vault_categories). A deleted category shows as To sort.
 */
export function CategoryField({
  value,
  onChange,
  categories,
  className,
}: {
  value: CategoryChoice;
  onChange: (choice: CategoryChoice) => void;
  categories: CategorySummary[];
  className?: string;
}) {
  const t = useTranslations("vaultItem.form");
  const label = useCategoryLabel();
  const builtIn = useSortedCategories();
  const hidden = useHiddenCategoryGroups();
  const current = shownFiling(
    value,
    hidden,
    categories.map((category) => category.id as string),
  );
  return (
    <Field label={t("category")} className={className}>
      {(id) => (
        <Select<string>
          id={id}
          variant="field"
          value={choiceKey(current)}
          onValueChange={(next) => onChange(choiceOf(next))}
        >
          {builtIn.map((category) => (
            <SelectItem key={category.key} value={category.key}>
              {label(category.key)}
            </SelectItem>
          ))}
          {categories.map((category) => (
            <SelectItem
              key={category.id}
              value={choiceKey({
                category: CUSTOM_FALLBACK,
                categoryId: category.id,
              })}
            >
              {category.name ?? t("lockedCategory")}
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

/** "Who can see it": a select-like box that opens the contact checklist. */
export function AccessField({
  value,
  onChange,
  emptyLabel,
  className,
}: {
  value: ContactId[];
  onChange: (contacts: ContactId[]) => void;
  /** What nobody picked means, when not "Only you" (welcome message). */
  emptyLabel?: string;
  className?: string;
}) {
  const t = useTranslations("vaultItem.form");
  const contacts = useShareableContacts();
  const names = contacts
    .filter((contact) => value.includes(contact._id))
    .map((contact) => contact.name);
  return (
    <Field label={t("whoCanSee")} className={className}>
      {(id) => (
        <Popover>
          <PopoverTrigger
            id={id}
            className="flex h-[46px] w-full items-center gap-[8px] rounded-sm border border-border-default bg-bg-surface px-[14px] text-left text-[15px] leading-[22px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <span className="min-w-0 flex-1 truncate">
              {names.length === 0 && emptyLabel
                ? emptyLabel
                : peopleSummary(names, t)}
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
            <ContactChecklist selected={value} onChange={onChange} />
          </PopoverContent>
        </Popover>
      )}
    </Field>
  );
}
