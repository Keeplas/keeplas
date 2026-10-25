import type { FunctionReturnType } from "convex/server";
import { Button, buttonVariants, cn, formatPhone, Icon } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import { IconTile, RowText } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/navigation";

export type SharedVault = FunctionReturnType<
  typeof api.trusted_contacts.getVaultsWhereIAmContact
>[number];

/**
 * Who chose me: their name and phone, so a homonym or a first name alone is
 * still recognisable. A nameless owner is named by their phone (backend
 * fallback), shown once.
 */
function ownerDetails(vault: SharedVault, detail: string) {
  return [
    vault.ownerPhone && vault.ownerPhone !== vault.ownerName
      ? formatPhone(vault.ownerPhone)
      : null,
    detail,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Released to me: what the owner left me, one click away. */
export function ReleasedVaultCard({ vault }: { vault: SharedVault }) {
  const t = useTranslations("sharedWithMe.card");
  const href = `/shared-with-me/${vault._id}/memorial`;
  return (
    <article className="flex flex-col gap-[16px] rounded-[16px] border border-border-default bg-bg-surface p-[20px]">
      <Link
        href={href}
        className="flex items-center gap-[12px] rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        <IconTile
          icon={ICON_PATHS.folder}
          className="bg-bg-info text-text-link"
        />
        <RowText
          title={formatPhone(vault.ownerName)}
          description={ownerDetails(
            vault,
            vault.releasedItemCount === 1
              ? t("oneItem")
              : t("items", { n: vault.releasedItemCount }),
          )}
        />
        <Icon
          path={ICON_PATHS.chevronRight}
          className="size-[20px] shrink-0 text-icon-subtle"
        />
      </Link>
      <Link
        href={href}
        className={buttonVariants({ variant: "primary", size: "regular" })}
      >
        {t("accessNow")}
      </Link>
    </article>
  );
}

/**
 * Not released to me: says when it would open. While the owner's Life check
 * waits for their trusted contacts, I can confirm I can't reach them (once).
 */
export function LockedVaultCard({
  vault,
  onUnreachable,
}: {
  vault: SharedVault;
  onUnreachable: (vault: SharedVault) => void;
}) {
  const t = useTranslations("sharedWithMe.card");
  const name = formatPhone(vault.ownerName);
  const n = vault.confirmationThreshold;
  const actionNeeded =
    vault.ownerCycleStatus === "awaiting_confirmation" &&
    !vault.unreachableConfirmed;

  let detail = t("trusted");
  let body = n === 1 ? t("laterOne", { name }) : t("later", { name, n });
  if (actionNeeded) {
    detail = t("unreachable.detail");
    body = t("unreachable.body", { n });
  } else if (vault.unreachableConfirmed) {
    detail = t("unreachable.confirmed");
    body = t("unreachable.waiting", { name });
  }

  return (
    <article
      className={cn(
        "flex flex-col gap-[12px] rounded-[16px] p-[20px]",
        actionNeeded ? "bg-bg-pending" : "bg-bg-warm",
      )}
    >
      <div className="flex items-center gap-[12px]">
        <IconTile
          icon={actionNeeded ? ICON_PATHS.alertTriangle : ICON_PATHS.lock}
          className={cn(
            "bg-bg-surface",
            actionNeeded ? "text-status-pending" : "text-text-link",
          )}
        />
        <RowText title={name} description={ownerDetails(vault, detail)} />
      </div>
      <p className="text-body-sm text-text-muted">{body}</p>
      {actionNeeded ? (
        <Button
          variant="primary"
          size="regular"
          className="self-start"
          onClick={() => onUnreachable(vault)}
        >
          {t("unreachable.action")}
        </Button>
      ) : null}
    </article>
  );
}
