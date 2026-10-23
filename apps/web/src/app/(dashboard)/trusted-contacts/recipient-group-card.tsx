import { useState } from "react";
import { api } from "@keeplas/backend/_generated/api";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import { Button, cn, Icon } from "@keeplas/ui";
import { IconTile, Panel, StatusChip } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { EditGroupDialog } from "./edit-group-dialog";

interface RecipientGroupCardProps {
  group: Doc<"recipient_groups">;
  contacts: Doc<"trusted_contacts">[];
}

export function RecipientGroupCard({
  group,
  contacts,
}: RecipientGroupCardProps) {
  const t = useTranslations("trustedContacts");
  const [showActions, setShowActions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [busy, setBusy] = useState(false);

  const setDefaultGroup = useAuditedMutation(
    api.recipient_groups.setDefaultGroup,
  );
  const deleteGroup = useAuditedMutation(api.recipient_groups.deleteGroup);

  const memberContacts = contacts.filter((c) =>
    group.memberContactIds.includes(c._id),
  );

  async function handleSetDefault() {
    if (group.isDefault) return;
    setBusy(true);
    try {
      await setDefaultGroup({ groupId: group._id });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    try {
      await deleteGroup({ groupId: group._id });
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <Panel
      className={cn(
        "flex flex-col gap-[12px] p-[20px]",
        group.isDefault && "border-border-strong",
      )}
    >
      <div className="flex items-start justify-between gap-[12px]">
        {/* Custom group colors are user data, hence the inline style. */}
        <span
          className="flex shrink-0 rounded-full bg-bg-info text-text-link"
          style={group.color ? { backgroundColor: group.color } : undefined}
        >
          <IconTile icon={ICON_PATHS.people} />
        </span>
        {group.isDefault && (
          <StatusChip
            tone="neutral"
            label={t("groupCard.default")}
            dotClassName="bg-progress-fill"
          />
        )}
      </div>

      <div className="flex flex-col gap-[4px]">
        <h3 className="text-h3 text-text-primary">{group.name}</h3>
        {group.description && (
          <p className="text-body-sm text-text-muted">{group.description}</p>
        )}
      </div>

      <p className="text-body-sm text-text-muted">
        {memberContacts.length === 1
          ? t("groupCard.memberCountOne", { count: memberContacts.length })
          : t("groupCard.memberCountMany", { count: memberContacts.length })}
      </p>

      <div className="flex min-h-[26px] flex-wrap gap-[6px]">
        {memberContacts.length === 0 ? (
          <span className="text-body-sm italic text-text-subtle">
            {t("groupCard.noMembers")}
          </span>
        ) : (
          memberContacts
            .slice(0, 5)
            .map((c) => (
              <StatusChip key={c._id} tone="neutral" label={c.name} />
            ))
        )}
        {memberContacts.length > 5 && (
          <StatusChip tone="neutral" label={`+${memberContacts.length - 5}`} />
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border-default pt-[12px]">
        <Button
          variant="link"
          size="compact"
          onClick={() => setShowEdit(true)}
          className="px-0"
        >
          {t("groupCard.manageMembers")}
        </Button>
        {!group.isDefault && (
          <Button
            variant="plain"
            size="compact"
            onClick={() => setShowActions(!showActions)}
            className="w-[36px] px-0 text-text-muted"
            aria-label={t("groupCard.more")}
            aria-expanded={showActions}
          >
            <Icon
              path={ICON_PATHS.more}
              strokeWidth={2.6}
              className="size-[20px]"
            />
          </Button>
        )}
      </div>

      {showActions && !group.isDefault && (
        <div className="flex flex-col gap-[8px] border-t border-border-default pt-[12px]">
          <Button
            variant="bordered"
            size="compact"
            onClick={handleSetDefault}
            disabled={busy}
            className="justify-start"
          >
            {t("groupCard.setDefault")}
          </Button>
          {confirmDelete ? (
            <div className="flex gap-[8px]">
              <Button
                variant="danger"
                size="compact"
                onClick={handleDelete}
                disabled={busy}
                className="flex-1"
              >
                {busy ? t("groupCard.deleting") : t("groupCard.confirmDelete")}
              </Button>
              <Button
                variant="plain"
                size="compact"
                onClick={() => setConfirmDelete(false)}
                className="flex-1"
              >
                {t("groupCard.cancel")}
              </Button>
            </div>
          ) : (
            <Button
              variant="danger"
              size="compact"
              onClick={handleDelete}
              className="justify-start"
            >
              {t("groupCard.deleteGroup")}
            </Button>
          )}
        </div>
      )}

      <EditGroupDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        group={group}
        contacts={contacts}
      />
    </Panel>
  );
}
