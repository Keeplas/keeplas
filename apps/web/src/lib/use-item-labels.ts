import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { groupOf } from "@keeplas/backend/lib/vault_groups";
import { formatBytes, formatClock } from "./format";
import { useLocale, useTranslations } from "./i18n";
import { useCategoryLabel } from "./use-categories";
import { useVaultData } from "./vault-data";
import {
  categoryLabelKey,
  extensionOf,
  sharedWith,
  type AccessPeople,
  type VaultItemSummary,
} from "./vault-list";

export interface ItemAccess {
  icon: "lock" | "user" | "people";
  label: string;
  contactIds: Id<"trusted_contacts">[];
}

/**
 * How an item reads on the vault screens: its title, the "PDF · 2.4 MB"
 * detail, the Category column, its folder and who it is shared with.
 */
export function useItemLabels() {
  const t = useTranslations("vaultList");
  const categoryLabel = useCategoryLabel();
  const locale = useLocale();
  const { folders, categories } = useVaultData();
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const groups = useQuery(api.recipient_groups.listGroups);

  return useMemo(() => {
    const contactNames = new Map(
      (contacts ?? []).map((contact) => [contact._id as string, contact.name]),
    );
    const groupMembers = new Map(
      (groups ?? []).map((group) => [
        group._id as string,
        group.memberContactIds,
      ]),
    );
    const allContacts = (contacts ?? []).map((contact) => contact._id);
    const folderOf = (item: VaultItemSummary) =>
      folders?.find((folder) => folder.id === item.folderId);

    function people(item: VaultItemSummary): AccessPeople {
      return {
        contactNames,
        groupMembers,
        allContacts,
        folderGrantees: (folderOf(item)?.grants ?? []).map(
          (grant) => grant.contactId,
        ),
      };
    }

    return {
      /** Contacts, groups and folders loaded: access labels are final. */
      ready:
        contacts !== undefined && groups !== undefined && folders !== undefined,

      title(item: VaultItemSummary): string {
        if (item.title === null) return t("locked");
        return item.title.trim() || t("untitled");
      },

      detail(item: VaultItemSummary): string {
        const [file] = item.files;
        if (item.kind === "notes") {
          const head =
            groupOf(item.category) === "accounts"
              ? t("detail.account")
              : t("detail.note");
          if (item.files.length === 0) return head;
          return `${head} · ${
            item.files.length === 1
              ? t("detail.attachmentOne")
              : t("detail.attachments", { count: item.files.length })
          }`;
        }
        const size = formatBytes(file.size, locale);
        const length = file.durationSec
          ? formatClock(file.durationSec)
          : undefined;
        switch (item.kind) {
          case "photos":
            return `${t("detail.photo")} · ${size}`;
          case "voice":
            return `${t("detail.voice")} · ${length ?? size}`;
          case "videos":
            return `${t("detail.video")} · ${length ?? size}`;
          default: {
            const extension = extensionOf(file.name).toUpperCase();
            if (extension === "PDF") return `PDF · ${size}`;
            return [t("detail.document"), extension, size]
              .filter(Boolean)
              .join(" · ");
          }
        }
      },

      category(item: VaultItemSummary): string {
        const custom = item.categoryId
          ? categories?.find((category) => category.id === item.categoryId)
              ?.name
          : undefined;
        if (custom) return custom;
        const label = categoryLabelKey(item);
        return label.type === "category"
          ? categoryLabel(label.key)
          : t(`lists.${label.key}`);
      },

      folder(item: VaultItemSummary): string | null {
        if (!item.folderId) return null;
        return folderOf(item)?.name ?? null;
      },

      /**
       * Who the item itself is shared with (one by one, by group, or every
       * trusted contact), without its folder's grantees: what the sharing
       * pickers start from.
       */
      recipients(item: VaultItemSummary): Id<"trusted_contacts">[] {
        return sharedWith(item.sharing, {
          ...people(item),
          folderGrantees: [],
        });
      },

      access(item: VaultItemSummary): ItemAccess {
        const contactIds = sharedWith(item.sharing, people(item));
        if (contactIds.length === 0) {
          return { icon: "lock", label: t("access.onlyYou"), contactIds };
        }
        if (contactIds.length === 1) {
          return {
            icon: "user",
            label: contactNames.get(contactIds[0]) ?? "",
            contactIds,
          };
        }
        return {
          icon: "people",
          label: t("access.people", { count: contactIds.length }),
          contactIds,
        };
      },
    };
  }, [t, categoryLabel, locale, folders, categories, contacts, groups]);
}
