import { describe, expect, it } from "vitest";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  categoryLabelKey,
  filterItems,
  itemStyle,
  sharedWith,
  sortItems,
  type AccessPeople,
  type ItemSharing,
  type VaultItemSummary,
} from "../vault-list";

const contact = (id: string) => id as Id<"trusted_contacts">;
const group = (id: string) => id as Id<"recipient_groups">;

const PRIVATE: ItemSharing = {
  accessLevel: "private",
  recipientMode: "default",
  contacts: [],
  groups: [],
};

function item(overrides: Partial<VaultItemSummary>): VaultItemSummary {
  return {
    id: "item" as Id<"vault_items">,
    title: "Untitled",
    category: "personal_document",
    kind: "documents",
    files: [],
    sharing: PRIVATE,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const people: AccessPeople = {
  contactNames: new Map([
    ["sarah", "Sarah"],
    ["daniel", "Daniel"],
    ["maya", "Maya"],
  ]),
  groupMembers: new Map([["family", [contact("sarah"), contact("daniel")]]]),
  allContacts: [contact("sarah"), contact("daniel"), contact("maya")],
};

describe("vault list", () => {
  it("styles an item by its group, else by what it holds", () => {
    expect(itemStyle({ category: "credential", kind: "documents" })).toBe(
      "accounts",
    );
    expect(itemStyle({ category: "wishes", kind: "notes" })).toBe(
      "instructions",
    );
    expect(itemStyle({ category: "personal_document", kind: "photos" })).toBe(
      "documents",
    );
    expect(itemStyle({ category: "other", kind: "photos" })).toBe("photos");
    // Inbox captures look like what they hold.
    expect(itemStyle({ category: "inbox", kind: "voice" })).toBe("voice");
  });

  it("names the precise document category, else the list", () => {
    expect(
      categoryLabelKey({ category: "insurance_policy", kind: "documents" }),
    ).toEqual({ type: "category", key: "insurance_policy" });
    expect(
      categoryLabelKey({ category: "personal_document", kind: "photos" }),
    ).toEqual({ type: "list", key: "documents" });
    expect(categoryLabelKey({ category: "other", kind: "photos" })).toEqual({
      type: "list",
      key: "photos",
    });
    expect(
      categoryLabelKey({ category: "health_directive", kind: "documents" }),
    ).toEqual({ type: "list", key: "instructions" });
  });

  it("keeps private items to the owner", () => {
    expect(sharedWith(PRIVATE, people)).toEqual([]);
  });

  it("resolves explicit, group and v1 default shares", () => {
    const shared = { ...PRIVATE, accessLevel: "trusted_only" as const };
    expect(
      sharedWith(
        { ...shared, recipientMode: "explicit", contacts: [contact("maya")] },
        people,
      ),
    ).toEqual(["maya"]);
    expect(
      sharedWith(
        { ...shared, recipientMode: "groups", groups: [group("family")] },
        people,
      ),
    ).toEqual(["sarah", "daniel"]);
    expect(sharedWith(shared, people)).toEqual(["sarah", "daniel", "maya"]);
  });

  it("drops revoked contacts", () => {
    expect(
      sharedWith(
        {
          ...PRIVATE,
          accessLevel: "trusted_only",
          recipientMode: "explicit",
          contacts: [contact("gone"), contact("sarah")],
        },
        people,
      ),
    ).toEqual(["sarah"]);
  });

  it("filters by list and searches titles and file names", () => {
    const items = [
      item({ id: "a" as Id<"vault_items">, title: "Will" }),
      item({
        id: "b" as Id<"vault_items">,
        title: "Keys",
        category: "other",
        kind: "photos",
        files: [
          {
            name: "Spare keys.jpg",
            mimeType: "image/jpeg",
            size: 1,
            kind: "image",
          },
        ],
      }),
      item({
        id: "c" as Id<"vault_items">,
        title: "Bank",
        category: "credential",
      }),
    ];
    expect(filterItems(items, "photos", "").map((i) => i.id)).toEqual(["b"]);
    expect(filterItems(items, "all", "spare").map((i) => i.id)).toEqual(["b"]);
    expect(filterItems(items, "accounts", " BANK ").map((i) => i.id)).toEqual([
      "c",
    ]);
  });

  it("sorts by last update, date added or name", () => {
    const items = [
      item({
        id: "a" as Id<"vault_items">,
        title: "beta",
        createdAt: 3,
        updatedAt: 1,
      }),
      item({
        id: "b" as Id<"vault_items">,
        title: "Alpha",
        createdAt: 1,
        updatedAt: 3,
      }),
      item({
        id: "c" as Id<"vault_items">,
        title: null,
        createdAt: 2,
        updatedAt: 2,
      }),
    ];
    const ids = (sorted: VaultItemSummary[]) => sorted.map((i) => i.id);
    expect(ids(sortItems(items, "updated", "en"))).toEqual(["b", "c", "a"]);
    expect(ids(sortItems(items, "added", "en"))).toEqual(["a", "c", "b"]);
    expect(ids(sortItems(items, "name", "en"))).toEqual(["c", "b", "a"]);
  });
});
