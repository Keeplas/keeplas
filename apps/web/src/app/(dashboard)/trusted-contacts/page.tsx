import { useEffect, useState } from "react";
import { Link } from "@/lib/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import type { Doc } from "@keeplas/backend/_generated/dataModel";
import {
  buttonVariants,
  cn,
  HelpHint,
  Icon,
  InfoCallout,
  Loader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@keeplas/ui";
import { ShellPage } from "@/components/shell/shell-page";
import { IconTile, Panel, RowText } from "@/components/v2/surface";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";
import { ContactCard } from "./contact-card";
import { ContactDetailSheet } from "./contact-detail-sheet";
import { InviteContactDialog } from "./invite-contact-dialog";
import { NoContactsMessage } from "./no-contacts-message";
import { AccessRequestsSection } from "./access-requests-section";
import { RecipientGroupCard } from "./recipient-group-card";
import { CreateGroupDialog } from "./create-group-dialog";
import { MIN_TRUST_CONTACTS_FOR_RECOVERY } from "./contact-display";

const MAX_TRUST_CONTACTS = 5;

const GUARDIAN_ROLES = [
  { icon: ICON_PATHS.shieldCheck, key: "noVaultAccess" },
  { icon: ICON_PATHS.user, key: "confirmsUnreachable" },
  { icon: ICON_PATHS.send, key: "releasesVault" },
] as const;

const GROUP_STEPS = ["step1", "step2", "step3"] as const;

const NETWORK_DOT = {
  unprotected: "bg-action-danger",
  atRisk: "bg-status-pending",
  quorumMet: "bg-status-active",
  resilient: "bg-status-active",
} as const;

// The legacy Tabs primitive restyled as the v2 segmented control.
const TABS_LIST =
  "gap-[4px] rounded-md border border-border-default bg-bg-surface p-[4px] text-text-muted";
const TAB_TRIGGER =
  "gap-[6px] rounded-sm px-[16px] py-[8px] text-label font-semibold hover:text-text-primary focus-visible:ring-border-focus data-[state=active]:bg-action-primary data-[state=active]:text-text-inverse data-[state=active]:shadow-none";
const TAB_CONTENT = "focus-visible:ring-border-focus";

// Main column, then the 380 px side column (W04 frames).
const COLUMNS =
  "grid items-start gap-[20px] lg:grid-cols-[minmax(0,1fr)_380px]";

/** Dashed "add" tile closing a grid of cards. */
function AddTile({
  title,
  hint,
  onClick,
}: {
  title: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[132px] w-full flex-col items-center justify-center gap-[8px] rounded-md border-[1.5px] border-dashed border-border-strong p-[20px] text-center transition-colors hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
    >
      <IconTile
        icon={ICON_PATHS.plus}
        size={40}
        className="bg-bg-accent text-text-accent"
      />
      <span className="text-label text-text-primary">{title}</span>
      {hint ? (
        <span className="max-w-md text-body-sm text-text-muted">{hint}</span>
      ) : null}
    </button>
  );
}

/** Section title with its count and help hint. */
function SectionTitle({
  title,
  count,
  help,
}: {
  title: string;
  count: string;
  help: string;
}) {
  return (
    <h2 className="flex items-center gap-[6px] text-h3 text-text-primary">
      {title}
      <span className="text-body-sm text-text-muted">({count})</span>
      <HelpHint content={help} />
    </h2>
  );
}

export default function TrustedContactsPage() {
  const t = useTranslations("trustedContacts");
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const groups = useQuery(api.recipient_groups.listGroups);
  const ensureDefaults = useMutation(api.onboarding.ensureDefaults);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteType, setInviteType] = useState<"trust" | "recipient_only">(
    "trust",
  );
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [selectedContact, setSelectedContact] =
    useState<Doc<"trusted_contacts"> | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Self-heal: existing users who finished onboarding before the default
  // recipient group was part of the seed need to be topped up the first time
  // they land here. Two regression shapes to repair, both routed through the
  // same idempotent server mutation:
  //   1. No default group at all → seedDefaults creates one.
  //   2. Default group exists but is empty while trust contacts already
  //      exist (previous broken seed) → seedDefaults' top-up branch backfills
  //      it. After that the condition is false and we leave manual edits be.
  useEffect(() => {
    if (!groups || !contacts) return;
    const defaultGroup = groups.find((g) => g.isDefault);
    const hasTrustContacts = contacts.some(
      (c) =>
        (c.contactType ?? "trust") === "trust" &&
        c.invitationStatus !== "revoked",
    );
    const needsSeed = !defaultGroup;
    const needsTopUp =
      !!defaultGroup &&
      defaultGroup.memberContactIds.length === 0 &&
      hasTrustContacts;
    if (needsSeed || needsTopUp) {
      void ensureDefaults();
    }
  }, [groups, contacts, ensureDefaults]);

  function openInvite(type: "trust" | "recipient_only") {
    setInviteType(type);
    setShowInviteDialog(true);
  }

  function openContact(contact: Doc<"trusted_contacts">) {
    setSelectedContact(contact);
    setSheetOpen(true);
  }

  if (contacts === undefined || groups === undefined) {
    return <Loader size="md" />;
  }

  const activeContacts = contacts.filter(
    (c) => c.invitationStatus !== "revoked",
  );
  const trustContacts = activeContacts.filter(
    (c) => (c.contactType ?? "trust") === "trust",
  );
  const recipientContacts = activeContacts.filter(
    (c) => c.contactType === "recipient_only",
  );
  const canInviteTrust = trustContacts.length < MAX_TRUST_CONTACTS;
  const acceptedTrustContacts = trustContacts.filter(
    (c) => c.invitationStatus === "accepted",
  );
  const pendingTrustCount = trustContacts.filter(
    (c) => c.invitationStatus === "pending",
  ).length;
  // Quorum = trust contacts needed to confirm the owner is unreachable.
  const threshold = MIN_TRUST_CONTACTS_FOR_RECOVERY;
  const acceptedCount = acceptedTrustContacts.length;
  const quorumPct = Math.min(
    100,
    (Math.min(acceptedCount, threshold) / MAX_TRUST_CONTACTS) * 100,
  );
  const bufferPct = Math.max(
    0,
    ((acceptedCount - threshold) / MAX_TRUST_CONTACTS) * 100,
  );
  const networkState: "unprotected" | "atRisk" | "quorumMet" | "resilient" =
    acceptedCount === 0
      ? "unprotected"
      : acceptedCount < threshold
        ? "atRisk"
        : acceptedCount === threshold
          ? "quorumMet"
          : "resilient";

  return (
    <ShellPage
      title={t("header.title")}
      subtitle={t("header.subtitle")}
      actions={
        <Link
          href="/docs/trusted-contacts"
          className={buttonVariants({ variant: "bordered", size: "regular" })}
        >
          <Icon path={ICON_PATHS.help} className="size-[18px]" />
          {t("header.howItWorks")}
        </Link>
      }
    >
      <InfoCallout icon={ICON_PATHS.activity}>
        <p>
          {t("header.medicalIdCallout")}{" "}
          <Link
            href="/docs/emergency-info"
            className="rounded-xs font-semibold text-text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            {t("header.learnHow")}
          </Link>
        </p>
      </InfoCallout>

      <Tabs defaultValue="contacts" className="flex flex-col gap-[20px]">
        <TabsList className={cn(TABS_LIST, "self-start")}>
          <TabsTrigger value="contacts" className={TAB_TRIGGER}>
            {t("tabs.contacts")}
            <span className="text-caption opacity-70">
              ({activeContacts.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="groups" className={TAB_TRIGGER}>
            {t("tabs.releaseGroups")}
            <span className="text-caption opacity-70">({groups.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="contacts"
          className={cn(TAB_CONTENT, "flex flex-col gap-[32px]")}
        >
          <div className={COLUMNS}>
            <div className="flex flex-col gap-[20px]">
              {acceptedCount > 0 &&
                acceptedCount < MIN_TRUST_CONTACTS_FOR_RECOVERY && (
                  <InfoCallout icon={ICON_PATHS.alertTriangle} tone="warning">
                    <p className="text-label text-text-primary">
                      {t("oneGuardianWarning.title")}
                    </p>
                    <p>
                      {t("oneGuardianWarning.body", {
                        name: acceptedTrustContacts[0].name,
                      })}
                    </p>
                  </InfoCallout>
                )}

              {activeContacts.length === 0 ? (
                <Panel className="flex justify-center">
                  <NoContactsMessage onAdd={() => openInvite("trust")} />
                </Panel>
              ) : (
                <>
                  <section className="flex flex-col gap-[12px]">
                    <SectionTitle
                      title={t("trustContacts.heading")}
                      count={`${trustContacts.length}/${MAX_TRUST_CONTACTS}`}
                      help={t("trustContacts.help")}
                    />
                    <div className="grid gap-[12px] md:grid-cols-2">
                      {trustContacts.map((contact) => (
                        <ContactCard
                          key={contact._id}
                          contact={contact}
                          onSelect={openContact}
                        />
                      ))}
                      {canInviteTrust && (
                        <AddTile
                          title={t("trustContacts.inviteNext")}
                          hint={t("trustContacts.slotsRemaining", {
                            count: MAX_TRUST_CONTACTS - trustContacts.length,
                          })}
                          onClick={() => openInvite("trust")}
                        />
                      )}
                    </div>
                  </section>

                  {(recipientContacts.length > 0 ||
                    trustContacts.length >= MAX_TRUST_CONTACTS) && (
                    <section className="flex flex-col gap-[12px]">
                      <SectionTitle
                        title={t("recipientsOnly.heading")}
                        count={`${recipientContacts.length}`}
                        help={t("recipientsOnly.help")}
                      />
                      {recipientContacts.length === 0 ? (
                        <AddTile
                          title={t("recipientsOnly.addTitle")}
                          hint={t("recipientsOnly.addDescription")}
                          onClick={() => openInvite("recipient_only")}
                        />
                      ) : (
                        <div className="grid gap-[12px] md:grid-cols-2">
                          {recipientContacts.map((contact) => (
                            <ContactCard
                              key={contact._id}
                              contact={contact}
                              onSelect={openContact}
                            />
                          ))}
                          <AddTile
                            title={t("recipientsOnly.addButton")}
                            onClick={() => openInvite("recipient_only")}
                          />
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}
            </div>

            <aside className="flex flex-col gap-[20px]">
              <Panel className="flex flex-col gap-[16px] p-[20px]">
                <div className="flex items-center gap-[12px]">
                  <IconTile
                    icon={ICON_PATHS.people}
                    size={48}
                    className="bg-bg-info text-text-link"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                    <h2 className="flex items-center gap-[6px] text-h3 text-text-primary">
                      {t("recoveryNetwork.title")}
                      <HelpHint
                        content={t("recoveryNetwork.help", { threshold })}
                      />
                    </h2>
                    <p className="text-body-sm text-text-muted">
                      {t("recoveryNetwork.stepLabel")}
                    </p>
                  </div>
                </div>

                <p className="flex items-baseline gap-[8px]">
                  <span className="text-display text-text-primary">
                    {acceptedCount}
                  </span>
                  <span className="text-body-lg text-text-muted">
                    / {threshold} {t("recoveryNetwork.quorum")}
                  </span>
                </p>

                <p className="flex items-center gap-[8px] text-label text-text-primary">
                  <span
                    className={cn(
                      "size-[8px] shrink-0 rounded-full",
                      NETWORK_DOT[networkState],
                    )}
                  />
                  {networkState === "unprotected" &&
                    t("recoveryNetwork.state.unprotected")}
                  {networkState === "atRisk" &&
                    t("recoveryNetwork.state.atRisk", {
                      count: threshold - acceptedCount,
                    })}
                  {networkState === "quorumMet" &&
                    t("recoveryNetwork.state.quorumMet")}
                  {networkState === "resilient" &&
                    (acceptedCount - threshold === 1
                      ? t("recoveryNetwork.state.resilientOne", {
                          count: acceptedCount - threshold,
                        })
                      : t("recoveryNetwork.state.resilientMany", {
                          count: acceptedCount - threshold,
                        }))}
                </p>

                <div className="flex h-[8px] w-full overflow-hidden rounded-full bg-progress-track">
                  <div
                    className="h-full bg-progress-fill transition-all"
                    style={{ width: `${quorumPct}%` }}
                  />
                  <div
                    className="h-full bg-progress-fill/40 transition-all"
                    style={{ width: `${bufferPct}%` }}
                  />
                </div>

                <dl className="flex flex-col gap-[8px] text-body-sm">
                  <div className="flex justify-between">
                    <dt className="text-text-muted">
                      {t("recoveryNetwork.accepted")}
                    </dt>
                    <dd className="font-semibold text-text-primary">
                      {acceptedCount}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted">
                      {t("recoveryNetwork.pendingInvites")}
                    </dt>
                    <dd className="font-semibold text-text-primary">
                      {pendingTrustCount}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-border-default pt-[8px] text-text-muted">
                    <dt>{t("recoveryNetwork.maxGuardians")}</dt>
                    <dd>{MAX_TRUST_CONTACTS}</dd>
                  </div>
                </dl>
              </Panel>

              <Panel className="flex flex-col gap-[16px] p-[20px]">
                <h2 className="text-h3 text-text-primary">
                  {t("guardians.heading")}
                </h2>
                {GUARDIAN_ROLES.map((role) => (
                  <div key={role.key} className="flex items-start gap-[12px]">
                    <IconTile
                      icon={role.icon}
                      size={40}
                      className="bg-bg-info text-text-link"
                    />
                    <RowText
                      title={t(`guardians.roles.${role.key}.title`)}
                      description={t(`guardians.roles.${role.key}.description`)}
                    />
                  </div>
                ))}
              </Panel>
            </aside>
          </div>

          <AccessRequestsSection />
        </TabsContent>

        <TabsContent value="groups" className={TAB_CONTENT}>
          <div className={COLUMNS}>
            {groups.length === 0 ? (
              // Transient state for existing users while the self-heal
              // mutation seeds their default group — the live query flips
              // to non-empty within a tick.
              <Panel className="flex items-center justify-center p-[48px]">
                <Loader size="sm" />
              </Panel>
            ) : (
              <div className="grid gap-[12px] md:grid-cols-2">
                {groups.map((group) => (
                  <RecipientGroupCard
                    key={group._id}
                    group={group}
                    contacts={contacts}
                  />
                ))}
                <AddTile
                  title={t("groups.newGroup")}
                  hint={t("groups.newGroupHint")}
                  onClick={() => setShowCreateGroup(true)}
                />
              </div>
            )}

            <Panel className="flex flex-col gap-[12px] p-[20px]">
              <h2 className="text-h3 text-text-primary">
                {t("howGroups.heading")}
              </h2>
              <p className="text-body-sm text-text-muted">
                {t("howGroups.intro")}
              </p>
              <ol className="flex flex-col gap-[12px]">
                {GROUP_STEPS.map((step, index) => (
                  <li
                    key={step}
                    className="flex items-start gap-[12px] text-body-sm text-text-body"
                  >
                    <span className="flex size-[24px] shrink-0 items-center justify-center rounded-full bg-bg-info text-caption text-text-link">
                      {index + 1}
                    </span>
                    <span className="pt-[3px]">{t(`howGroups.${step}`)}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        </TabsContent>
      </Tabs>

      <InviteContactDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        initialContactType={inviteType}
      />
      <CreateGroupDialog
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        contacts={contacts}
      />
      <ContactDetailSheet
        contact={selectedContact}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </ShellPage>
  );
}
