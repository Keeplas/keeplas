import { useState } from "react";
import { Icon, Loader } from "@keeplas/ui";
import { ShellPage } from "@/components/shell/shell-page";
import { StateMessage } from "@/components/state-message";
import { Modal } from "@/components/v2/modal";
import { IconTile, Panel, RowText } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import {
  LockedVaultCard,
  ReleasedVaultCard,
  type SharedVault,
} from "./shared-vault-card";

/** How a vault opens to a trusted contact, in order (help dialog). */
const RELEASE_STEPS = [
  { icon: ICON_PATHS.activity, key: "checkIn" },
  { icon: ICON_PATHS.bell, key: "silent" },
  { icon: ICON_PATHS.people, key: "confirm" },
  { icon: ICON_PATHS.clock, key: "grace" },
  { icon: ICON_PATHS.eye, key: "yours" },
] as const;

/** Section 10 "Nothing shared with you yet". */
export function NothingSharedMessage() {
  const t = useTranslations("sharedWithMe.empty");
  return (
    <StateMessage icon={ICON_PATHS.inbox} title={t("title")} body={t("body")} />
  );
}

/** "When does a vault open?": the release steps, from Life check to access. */
function ReleaseStepsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("sharedWithMe.help");
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      width="w-[520px]"
    >
      <ol className="flex flex-col gap-[16px]">
        {RELEASE_STEPS.map((step) => (
          <li key={step.key} className="flex items-start gap-[12px]">
            <IconTile
              icon={step.icon}
              size={40}
              className="bg-bg-info text-text-link"
            />
            <RowText title={t(step.key)} description={t(`${step.key}Body`)} />
          </li>
        ))}
      </ol>
      <p className="flex items-start gap-[10px] rounded-sm bg-bg-subtle p-[14px] text-body-sm text-text-body">
        <Icon
          path={ICON_PATHS.lock}
          className="size-[18px] shrink-0 text-icon-default"
        />
        {t("note")}
      </p>
    </Modal>
  );
}

/**
 * W04-4 Shared with me: the people who chose me as a trusted contact, when
 * their vault would open, and what they left me once it is released.
 */
export function SharedVaultListView({
  vaults,
  onUnreachable,
  helpOpen: initialHelpOpen = false,
}: {
  /** Undefined while loading. */
  vaults: SharedVault[] | undefined;
  onUnreachable: (vault: SharedVault) => void;
  /** Visual harness only: render with the help dialog open. */
  helpOpen?: boolean;
}) {
  const t = useTranslations("sharedWithMe");
  const [helpOpen, setHelpOpen] = useState(initialHelpOpen);

  return (
    <ShellPage title={t("title")} subtitle={t("subtitle")}>
      {!vaults ? (
        <Loader />
      ) : vaults.length === 0 ? (
        <Panel className="flex justify-center">
          <NothingSharedMessage />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 items-start gap-[16px] lg:grid-cols-2">
          {vaults.map((vault) =>
            vault.released ? (
              <ReleasedVaultCard key={vault._id} vault={vault} />
            ) : (
              <LockedVaultCard
                key={vault._id}
                vault={vault}
                onUnreachable={onUnreachable}
              />
            ),
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        className="flex min-h-[68px] items-center gap-[14px] rounded-md border border-border-default bg-bg-surface px-[14px] text-left transition-colors hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        <IconTile
          icon={ICON_PATHS.help}
          className="bg-bg-info text-text-link"
        />
        <RowText title={t("help.link")} />
        <Icon
          path={ICON_PATHS.chevronRight}
          className="size-[20px] shrink-0 text-icon-subtle"
        />
      </button>
      <ReleaseStepsModal open={helpOpen} onOpenChange={setHelpOpen} />
    </ShellPage>
  );
}
