import {
  bucketOf,
  groupOf,
  inVaultList,
  type ContentKind,
  type VaultListKey,
} from "@keeplas/backend/lib/vault_groups";
import type { Doc, Id } from "@keeplas/backend/_generated/dataModel";
import type { FileMeta } from "./item-meta";
import type { VaultCategory } from "./vault-categories";

/** An owner's vault item with its sealed fields opened (title, meta, files). */
export interface VaultItemSummary {
  id: Id<"vault_items">;
  /** null when the item cannot be decrypted in this browser. */
  title: string | null;
  category: VaultCategory;
  kind: ContentKind;
  icon?: string;
  files: Omit<FileMeta, "v">[];
  /** User-made category (vault_categories), from the sealed metadata. */
  categoryId?: string;
  sharing: ItemSharing;
  createdAt: number;
  updatedAt: number;
}

/** Who an item is passed on to, as stored on the item (v1 groups included). */
export interface ItemSharing {
  accessLevel: Doc<"vault_items">["accessLevel"];
  recipientMode: "default" | "groups" | "explicit";
  contacts: Id<"trusted_contacts">[];
  groups: Id<"recipient_groups">[];
}

/** The look of an item (tile color and icon): its list, by content kind. */
export type ItemStyle = Exclude<ReturnType<typeof bucketOf>, "inbox">;

export function itemStyle(item: {
  category: string;
  kind: ContentKind;
}): ItemStyle {
  const bucket = bucketOf(item);
  return bucket === "inbox" ? item.kind : bucket;
}

/**
 * What the Category column says (W06-1): the precise category for the
 * documents that have one (Insurance, Legal, Property…), otherwise the list
 * the item is in (Instructions, Photos, Voice notes…).
 */
export function categoryLabelKey(item: {
  category: VaultCategory;
  kind: ContentKind;
}):
  | { type: "category"; key: VaultCategory }
  | { type: "list"; key: VaultListKey } {
  if (
    groupOf(item.category) === "documents" &&
    item.category !== "personal_document"
  ) {
    return { type: "category", key: item.category };
  }
  return { type: "list", key: bucketOf(item) };
}

/** Lowercase file extension ("pdf"), or "" without one. */
export const extensionOf = (name: string) =>
  name.includes(".") ? (name.split(".").pop()?.toLowerCase() ?? "") : "";

export interface AccessPeople {
  contactNames: Map<string, string>;
  groupMembers: Map<string, Id<"trusted_contacts">[]>;
  /** Every live trusted contact ("default" mode shares with all of them). */
  allContacts: Id<"trusted_contacts">[];
}

/**
 * The people who can open the item once released: its own recipients (one
 * by one, by group, or every trusted contact for v1 "default" shares).
 * Revoked contacts are not in the maps and drop out.
 */
export function sharedWith(
  sharing: ItemSharing,
  people: AccessPeople,
): Id<"trusted_contacts">[] {
  const ids = new Set<Id<"trusted_contacts">>();
  if (sharing.accessLevel !== "private") {
    if (sharing.recipientMode === "default") {
      people.allContacts.forEach((id) => ids.add(id));
    }
    if (sharing.recipientMode === "groups") {
      for (const group of sharing.groups) {
        people.groupMembers.get(group)?.forEach((id) => ids.add(id));
      }
    }
    sharing.contacts.forEach((id) => ids.add(id));
  }
  return [...ids].filter((id) => people.contactNames.has(id));
}

export type VaultSort = "updated" | "name" | "added";

export function sortItems(
  items: readonly VaultItemSummary[],
  sort: VaultSort,
  locale: string,
): VaultItemSummary[] {
  const sorted = [...items];
  if (sort === "name") {
    const collator = new Intl.Collator(locale, { sensitivity: "base" });
    return sorted.sort((a, b) =>
      collator.compare(a.title ?? "", b.title ?? ""),
    );
  }
  const field = sort === "added" ? "createdAt" : "updatedAt";
  return sorted.sort((a, b) => b[field] - a[field]);
}

/** Items of one list whose title or file names contain the search. */
export function filterItems(
  items: readonly VaultItemSummary[],
  list: VaultListKey,
  search: string,
): VaultItemSummary[] {
  const needle = search.trim().toLocaleLowerCase();
  return items.filter(
    (item) =>
      inVaultList(item, list) &&
      (!needle ||
        (item.title ?? "").toLocaleLowerCase().includes(needle) ||
        item.files.some((file) =>
          file.name.toLocaleLowerCase().includes(needle),
        )),
  );
}
