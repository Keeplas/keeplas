import { useState, type ReactNode } from "react";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import {
  GROUP_CATEGORIES,
  inGroup,
  type VaultGroupKey,
} from "@keeplas/backend/lib/vault_groups";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Icon,
  Input,
  Label,
  toast,
  useConfirm,
} from "@keeplas/ui";
import { Field } from "@/components/vault/form-fields";
import { Panel } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useHiddenCategoryGroups } from "@/lib/use-categories";
import { useVaultCrypto } from "@/lib/use-vault-crypto";
import { useVaultData } from "@/lib/vault-data";

const GROUPS = Object.keys(GROUP_CATEGORIES) as VaultGroupKey[];

interface CategoryToDelete {
  label: string;
  itemIds: Id<"vault_items">[];
  /** Deletes a user-made category, or hides a built-in one. */
  remove: () => Promise<unknown>;
}

function Row({
  label,
  detail,
  action,
}: {
  label: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-[12px] border-b border-border-default py-[14px] last:border-b-0">
      <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="truncate text-label text-text-primary">{label}</span>
        {detail ? (
          <span className="text-body-sm text-text-muted">{detail}</span>
        ) : null}
      </span>
      {action}
    </li>
  );
}

/**
 * Settings → Categories: delete built-in categories (restorable) and add or
 * delete your own. Deleting a category archives its items, after the owner
 * types DELETE when there are any; To sort always stays.
 */
export default function CategoriesPage() {
  const t = useTranslations("settings.categories");
  const lists = useTranslations("vaultList.lists");
  const deleteAccount = useTranslations("settings.deleteAccount");
  const confirm = useConfirm();
  const { categories, items } = useVaultData();
  const hidden = useHiddenCategoryGroups();
  const { encryptContent } = useVaultCrypto();
  const setHidden = useAuditedMutation(api.users.setHiddenCategoryGroups);
  const create = useAuditedMutation(api.vault_categories.create);
  const remove = useAuditedMutation(api.vault_categories.remove);
  const archiveItems = useAuditedMutation(api.vault_items.archiveItems);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<CategoryToDelete | null>(null);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const word = deleteAccount("confirmWord");

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch {
      toast({ variant: "error", title: t("failed") });
    }
  }

  const itemsBody = (count: number) =>
    count === 1 ? t("deleteItemsOne") : t("deleteItems", { count });

  async function deleteCategory(category: CategoryToDelete) {
    if (category.itemIds.length) {
      await archiveItems({ itemIds: category.itemIds });
    }
    await category.remove();
  }

  async function confirmDelete(category: CategoryToDelete) {
    const count = category.itemIds.length;
    const ok = await confirm({
      title: t("deleteTitle", { name: category.label }),
      description: count ? itemsBody(count) : t("deleteEmptyBody"),
      confirmLabel: t("delete"),
      cancelLabel: t("cancel"),
      variant: "destructive",
    });
    if (!ok) return;
    if (!count) return run(() => deleteCategory(category));
    setPending(category);
    setTyped("");
    setTyping(true);
  }

  async function confirmTyped() {
    if (!pending || typed.trim().toUpperCase() !== word) return;
    setDeleting(true);
    await run(async () => {
      await deleteCategory(pending);
      setTyping(false);
    });
    setDeleting(false);
  }

  async function add() {
    if (!name.trim()) return;
    setAdding(true);
    await run(async () => {
      await create({ encryptedName: await encryptContent(name.trim()) });
      setName("");
    });
    setAdding(false);
  }

  const trash = (category: CategoryToDelete) => (
    <Button
      variant="plain"
      size="icon"
      aria-label={t("deleteTitle", { name: category.label })}
      onClick={() => void confirmDelete(category)}
    >
      <Icon path={ICON_PATHS.trash} className="size-[18px] text-icon-default" />
    </Button>
  );

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-[16px]">
      <div className="flex flex-col gap-[8px]">
        <h1 className="text-h1 text-text-primary">{t("title")}</h1>
        <p className="text-body-lg text-text-muted">{t("body")}</p>
      </div>

      <Panel className="px-[20px] py-[4px]">
        <ul>
          <Row label={lists("inbox")} detail={t("inboxBody")} />
          {GROUPS.filter((group) => !hidden.includes(group)).map((group) => (
            <Row
              key={group}
              label={lists(group)}
              action={trash({
                label: lists(group),
                itemIds: (items ?? [])
                  .filter((item) => inGroup(item, group))
                  .map((item) => item.id),
                remove: () => setHidden({ groups: [...hidden, group] }),
              })}
            />
          ))}
          {(categories ?? []).map((category) => {
            const label = category.name ?? t("locked");
            const itemIds = (items ?? [])
              .filter((item) => item.categoryId === category.id)
              .map((item) => item.id);
            const count = itemIds.length;
            return (
              <Row
                key={category.id}
                label={label}
                detail={count === 1 ? t("itemOne") : t("items", { count })}
                action={trash({
                  label,
                  itemIds,
                  remove: () => remove({ categoryId: category.id }),
                })}
              />
            );
          })}
        </ul>
      </Panel>

      <Panel className="flex flex-col gap-[12px] p-[20px]">
        <h2 className="text-h3 text-text-primary">{t("new")}</h2>
        <form
          className="flex items-end gap-[12px]"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <Field label={t("name")} className="flex-1">
            {(id) => (
              <Input
                id={id}
                variant="field"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>
          <Button
            type="submit"
            variant="primary"
            size="regular"
            disabled={!name.trim() || adding}
          >
            {t("create")}
          </Button>
        </form>
        <p className="text-body-sm text-text-muted">{t("newBody")}</p>
      </Panel>

      {hidden.length ? (
        <Panel className="flex flex-col gap-[4px] px-[20px] py-[12px]">
          <h2 className="text-h3 text-text-primary">{t("removed")}</h2>
          <ul>
            {hidden.map((group) => (
              <Row
                key={group}
                label={lists(group)}
                action={
                  <Button
                    variant="bordered"
                    size="regular"
                    onClick={() =>
                      void run(() =>
                        setHidden({
                          groups: hidden.filter((other) => other !== group),
                        }),
                      )
                    }
                  >
                    <Icon path={ICON_PATHS.rotate} className="size-[16px]" />
                    {t("restore")}
                  </Button>
                }
              />
            ))}
          </ul>
        </Panel>
      ) : null}

      <Dialog open={typing} onOpenChange={setTyping}>
        <DialogContent className="max-w-md space-y-5 p-6" role="alertdialog">
          <div className="space-y-2">
            <DialogTitle className="text-h3 text-text-primary">
              {pending ? t("deleteTitle", { name: pending.label }) : null}
            </DialogTitle>
            <DialogDescription className="text-body text-text-muted">
              {pending ? itemsBody(pending.itemIds.length) : null}
            </DialogDescription>
          </div>
          <form
            className="flex flex-col gap-[12px]"
            onSubmit={(event) => {
              event.preventDefault();
              void confirmTyped();
            }}
          >
            <Label htmlFor="confirm-category-delete">
              {deleteAccount("typeLabel", { word })}
            </Label>
            <Input
              id="confirm-category-delete"
              variant="field"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={word}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            <div className="flex justify-end gap-[8px]">
              <Button
                type="button"
                variant="plain"
                size="regular"
                onClick={() => setTyping(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                variant="danger"
                size="regular"
                disabled={deleting || typed.trim().toUpperCase() !== word}
              >
                {t("delete")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
