import type { ReactNode } from "react";
import { Button, buttonVariants, cn } from "@keeplas/ui";
import { ShellPage } from "@/components/shell/shell-page";
import { StateMessage } from "@/components/state-message";
import { ItemTable } from "@/components/v2/item-table";
import { ListRow } from "@/components/v2/list-row";
import { IconTile, Panel, RowText } from "@/components/v2/surface";
import { formatRelative } from "@/lib/format";
import { ICON_PATHS } from "@/lib/icons";
import { useLocale, useTranslations } from "@/lib/i18n";
import { Link, useRouter } from "@/lib/navigation";
import { AddItemMenu, type AddKind } from "@/components/vault/add-item-menu";

export interface HubRecentItem {
  id: string;
  title: string;
  /** Category column label ("Insurance Policies", "Accounts", "Photos"). */
  type: string;
  updatedAt: number;
}

export interface HubViewProps {
  firstName: string;
  /** At least one way back in besides this device (backup, contacts, kit). */
  recoveryCovered: boolean;
  /** Free accounts get the Lifetime upgrade card. */
  plan: "free" | "lifetime";
  counts: Record<"inbox" | "documents" | "accounts", number>;
  recentItems: HubRecentItem[];
  onAdd: (kind: AddKind) => void;
  onScan: () => void;
  /** Conditional notice above the setup card (return after release). */
  notice?: ReactNode;
  addMenuOpen?: boolean;
}

/** Section 10 "Your vault is empty". */
export function VaultEmptyMessage({ onAdd }: { onAdd: () => void }) {
  const t = useTranslations("hub.empty");
  return (
    <StateMessage icon={ICON_PATHS.folder} title={t("title")} body={t("body")}>
      <Button variant="primary" size="cta" className="w-full" onClick={onAdd}>
        {t("action")}
      </Button>
    </StateMessage>
  );
}

function greetingKey(hour: number) {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** W04-3 dashboard: recovery health, upgrade, tiles, recent items. */
export function HubView({
  firstName,
  recoveryCovered,
  plan,
  counts,
  recentItems,
  onAdd,
  onScan,
  notice,
  addMenuOpen,
}: HubViewProps) {
  const t = useTranslations("hub");
  const locale = useLocale();
  const router = useRouter();
  const greeting = t(`greeting.${greetingKey(new Date().getHours())}`, {
    name: firstName,
  });
  const itemCount = (count: number) =>
    count === 1 ? t("tiles.one") : t("tiles.other", { count });

  return (
    <ShellPage title={greeting} subtitle={t("subtitle")}>
      {notice}

      <ListRow
        href="/settings/recovery"
        icon={ICON_PATHS.shieldCheck}
        title={t("recovery.title")}
        description={t(
          recoveryCovered ? "recovery.covered" : "recovery.notCovered",
        )}
      />

      {plan === "free" ? (
        <Panel className="flex flex-wrap items-center gap-[16px] p-[20px]">
          <div className="flex min-w-[240px] flex-1 items-center gap-[14px]">
            <IconTile
              icon={ICON_PATHS.flash}
              className="bg-bg-info text-text-link"
            />
            <RowText
              title={t("upgrade.title")}
              description={t("upgrade.body")}
            />
          </div>
          <Link
            href="/settings/subscription"
            className={cn(buttonVariants({ variant: "primary", size: "cta" }))}
          >
            {t("upgrade.cta")}
          </Link>
        </Panel>
      ) : null}

      <div className="grid gap-[16px] md:grid-cols-3">
        <ListRow
          href="/vault?type=inbox"
          icon={ICON_PATHS.mail}
          title={t("tiles.inbox")}
          description={
            counts.inbox === 1
              ? t("tiles.toOrganizeOne")
              : t("tiles.toOrganize", { count: counts.inbox })
          }
        />
        <ListRow
          href="/vault?type=documents"
          icon={ICON_PATHS.document}
          title={t("tiles.documents")}
          description={itemCount(counts.documents)}
        />
        <ListRow
          href="/vault?type=accounts"
          icon={ICON_PATHS.userCircle}
          title={t("tiles.accounts")}
          description={itemCount(counts.accounts)}
        />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-h3 text-text-primary">{t("recent.title")}</h2>
        <AddItemMenu onAdd={onAdd} onScan={onScan} defaultOpen={addMenuOpen} />
      </div>

      {recentItems.length > 0 ? (
        <ItemTable
          headers={[t("recent.name"), t("recent.type"), t("recent.updated")]}
          columns="grid-cols-[minmax(0,1fr)_300px_200px_34px]"
          iconClassName="text-icon-default"
          rows={recentItems.map((item) => ({
            id: item.id,
            name: item.title,
            details: [item.type, formatRelative(item.updatedAt, locale)],
            onOpen: () => router.push(`/vault/${item.id}`),
            actions: [
              {
                label: t("recent.open"),
                onSelect: () => router.push(`/vault/${item.id}`),
              },
            ],
          }))}
        />
      ) : (
        <div className="flex justify-center rounded-[16px] border border-border-default bg-bg-surface">
          <VaultEmptyMessage onAdd={() => onAdd("document")} />
        </div>
      )}
    </ShellPage>
  );
}
