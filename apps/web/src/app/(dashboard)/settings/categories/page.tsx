import { useState, type ReactNode } from "react";
import { api } from "@keeplas/backend/_generated/api";
import {
  GROUP_CATEGORIES,
  type VaultGroupKey,
} from "@keeplas/backend/lib/vault_groups";
import { Button, Icon, Input, toast, useConfirm } from "@keeplas/ui";
import { Field } from "@/components/vault/form-fields";
import { Panel } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { useHiddenCategoryGroups } from "@/lib/use-categories";
import { useVaultCrypto } from "@/lib/use-vault-crypto";
import { useVaultData } from "@/lib/vault-data";

const GROUPS = Object.keys(GROUP_CATEGORIES) as VaultGroupKey[];

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
 * delete your own. Items of a deleted category show in To sort, which
 * always stays.
 */
export default function CategoriesPage() {
  const t = useTranslations("settings.categories");
  const lists = useTranslations("vaultList.lists");
  const confirm = useConfirm();
  const { categories, items } = useVaultData();
  const hidden = useHiddenCategoryGroups();
  const { encryptContent } = useVaultCrypto();
  const setHidden = useAuditedMutation(api.users.setHiddenCategoryGroups);
  const create = useAuditedMutation(api.vault_categories.create);
  const remove = useAuditedMutation(api.vault_categories.remove);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch {
      toast({ variant: "error", title: t("failed") });
    }
  }

  async function confirmDelete(label: string, action: () => Promise<unknown>) {
    const ok = await confirm({
      title: t("deleteTitle", { name: label }),
      description: t("deleteBody"),
      confirmLabel: t("delete"),
      cancelLabel: t("cancel"),
      variant: "destructive",
    });
    if (ok) await run(action);
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

  const trash = (label: string, action: () => Promise<unknown>) => (
    <Button
      variant="plain"
      size="icon"
      aria-label={t("deleteTitle", { name: label })}
      onClick={() => void confirmDelete(label, action)}
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
              action={trash(lists(group), () =>
                setHidden({ groups: [...hidden, group] }),
              )}
            />
          ))}
          {(categories ?? []).map((category) => {
            const label = category.name ?? t("locked");
            const count = (items ?? []).filter(
              (item) => item.categoryId === category.id,
            ).length;
            return (
              <Row
                key={category.id}
                label={label}
                detail={count === 1 ? t("itemOne") : t("items", { count })}
                action={trash(label, () => remove({ categoryId: category.id }))}
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
    </div>
  );
}
