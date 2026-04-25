"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  Button,
  cn,
  DatePicker,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
  HelpHint,
  Icon,
  InfoCallout,
  Input,
  Label,
  Loader,
  RichTextEditor,
  Select,
  SelectItem,
  UserAvatar,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useVaultCrypto } from "@/lib/use-vault-crypto";
import { getErrorMessage } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/format";
import { getInitials } from "@/lib/user";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { InviteContactDialog } from "../trusted-contacts/invite-contact-dialog";
import { MultiSelect, type MultiSelectOption } from "@/components/multi-select";

type TriggerType =
  | "life_check_failure"
  | "time_based"
  | "age_based"
  | "legal_event"
  | "manual";

interface TriggerOption {
  value: TriggerType;
  label: string;
  hint: string;
  comingSoon?: boolean;
  hidden?: boolean;
}

const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    value: "life_check_failure",
    label: "Verified Life-Check Failure",
    hint: "Released when you stop responding to Life Checks for the chosen number of days.",
  },
  {
    value: "time_based",
    label: "Time-based Release",
    hint: "Released on a specific calendar date — useful for birthdays, anniversaries, or coming-of-age letters.",
  },
  {
    value: "manual",
    label: "Manual Trigger",
    hint: "Released only when you (or a curator) explicitly approve from the dashboard.",
  },
  {
    value: "legal_event",
    label: "Verified Legal Event",
    hint: "Will require a curator-uploaded legal document. Coming soon.",
    comingSoon: true,
  },
  {
    value: "age_based",
    label: "Recipient Age",
    hint: "Replaced by Time-based Release — pick the recipient's birthday + age to compute the date.",
    hidden: true,
  },
];

const TRIGGER_LABELS: Record<TriggerType, string> = TRIGGER_OPTIONS.reduce(
  (acc, opt) => {
    acc[opt.value] = opt.label;
    return acc;
  },
  {} as Record<TriggerType, string>
);

const TRIGGER_ICONS: Record<TriggerType, string> = {
  life_check_failure: ICON_PATHS.heartbeat,
  time_based: ICON_PATHS.timer,
  age_based: ICON_PATHS.familyHistory,
  legal_event: ICON_PATHS.lawyer,
  manual: ICON_PATHS.editNote,
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft Status", color: "text-outline" },
  active: { label: "Active", color: "text-secondary" },
  sealed: { label: "Sealed", color: "text-tertiary" },
  released: { label: "Released", color: "text-error" },
  cancelled: { label: "Cancelled", color: "text-outline" },
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString([], {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function htmlToPlainText(html: string): string {
  if (typeof window === "undefined") return html.replace(/<[^>]+>/g, "").trim();
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? "").trim();
}

export default function ConditionalMessagesPage() {
  const messages = useQuery(api.conditional_messages.listMessages);
  const status = useQuery(api.conditional_messages.getDeadManStatus);
  const contacts = useQuery(api.trusted_contacts.getContacts);

  const [showCompose, setShowCompose] = useState(false);

  if (messages === undefined || status === undefined || contacts === undefined) {
    return <Loader fullscreen label="Loading conditional messages" />;
  }

  const activeMessages = messages.filter((m) => m.status === "active");
  const featured = activeMessages[0] ?? messages[0];
  const secondary = messages.filter((m) => m._id !== featured?._id).slice(0, 2);

  return (
    <div className="max-w-screen-2xl mx-auto space-y-16">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
        <div className="max-w-2xl space-y-3">
          <span className="text-label-md text-secondary block">
            Life Continuity Systems
          </span>
          <h1 className="text-headline-lg text-primary">
            Conditional Messages
          </h1>
          <p className="text-body-lg text-on-surface-variant">
            A sanctuary for words intended for the future. These messages remain encrypted
            and sealed until specific life events trigger their release.
          </p>
        </div>

        <div className="bg-primary-container p-8 rounded-xl text-on-primary-container min-w-[320px] shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <Icon
                path={ICON_PATHS.vibration}
                className="w-5 h-5 text-secondary-fixed"
              />
              <span className="text-label-md flex items-center gap-1.5">
                Dead Man Switch Status
                <HelpHint
                  iconClassName="text-on-primary-container/70 hover:text-secondary-fixed"
                  content="Monitors your Life Check responses. If you stop confirming, the switch escalates and ultimately triggers the release of any active conditional message tied to it."
                />
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-headline-md">
                {status.isActive ? "Active" : "Paused"}
              </span>
              <span className="bg-secondary/20 text-secondary-fixed px-3 py-1 rounded-full text-label-md">
                {status.isActive ? "Monitoring" : "Idle"}
              </span>
            </div>
            <p className="text-body-md opacity-80 mb-6">
              Last heartbeat detected:{" "}
              {status.lastHeartbeatAt
                ? `${formatTimeAgo(status.lastHeartbeatAt)} via Mobile App`
                : "no recent signal"}
              .
            </p>
            <button className="w-full bg-white/10 hover:bg-white/20 py-2 rounded-lg text-label-md transition-colors cursor-pointer">
              Configure Trigger Logic
            </button>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
            <Icon path={ICON_PATHS.lockClock} className="w-36 h-36" />
          </div>
        </div>
      </header>

      {/* Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Draft a New Legacy */}
        <button
          onClick={() => setShowCompose(true)}
          className="md:col-span-4 bg-surface-container-low p-8 rounded-xl flex flex-col justify-between group cursor-pointer hover:bg-surface-container-high transition-colors text-left"
        >
          <div>
            <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Icon path={ICON_PATHS.editNote} className="w-6 h-6 text-secondary" />
            </div>
            <h3 className="text-headline-md text-primary mb-2">
              Draft a New Legacy
            </h3>
            <p className="text-body-md text-on-surface-variant">
              Prepare a message for business partners, children, or spouse to be opened only
              when needed.
            </p>
          </div>
          <div className="mt-8 flex items-center gap-2 text-secondary font-bold text-body-md">
            Create Message
            <Icon path={ICON_PATHS.arrowForward} className="w-5 h-5" />
          </div>
        </button>

        {/* Featured Message */}
        {featured ? (
          <FeaturedMessage
            message={featured}
            contacts={contacts}
          />
        ) : (
          <div className="md:col-span-8 bg-surface-container p-8 rounded-xl ghost-border flex flex-col items-center justify-center text-center min-h-[280px]">
            <Icon
              path={ICON_PATHS.notes}
              className="w-10 h-10 text-outline-variant mb-4"
            />
            <h3 className="text-headline-sm text-primary mb-2">
              No messages yet
            </h3>
            <p className="text-body-lg text-on-surface-variant max-w-sm">
              Your first conditional message will appear here once composed.
            </p>
          </div>
        )}

        {/* Secondary cards */}
        {secondary.map((msg) => (
          <SecondaryCard key={msg._id} message={msg} />
        ))}
        {secondary.length < 2 &&
          Array.from({ length: 2 - secondary.length }).map((_, i) => (
            <button
              key={`placeholder-${i}`}
              onClick={() => setShowCompose(true)}
              className="md:col-span-6 bg-surface-container-low p-8 rounded-xl ghost-border flex flex-col items-start justify-center gap-2 min-h-[180px] hover:bg-surface-container transition-colors cursor-pointer text-left"
            >
              <Icon path={ICON_PATHS.plusCircle} className="w-8 h-8 text-outline-variant" />
              <span className="text-body-md text-on-surface-variant">Draft another message</span>
            </button>
          ))}

        {/* Dead Man Switch Philosophy */}
        <div className="md:col-span-12 mt-8 grid grid-cols-1 md:grid-cols-2 gap-12 bg-primary py-16 px-12 rounded-[2rem] text-white">
          <div className="space-y-6">
            <h2 className="text-headline-lg">
              The &ldquo;Dead Man Switch&rdquo; Philosophy
            </h2>
            <p className="text-body-lg text-on-primary-container">
              Our system uses a multi-layered verification protocol. If you fail to respond
              to check-ins over a predefined period, your designated &ldquo;Legacy
              Curators&rdquo; are contacted to verify your status before any message is
              unsealed.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <button className="bg-secondary-fixed text-on-secondary-fixed px-6 py-3 rounded-xl font-bold text-body-md transition-all active:scale-95 cursor-pointer">
                Verify Verification Logic
              </button>
              <button className="border border-on-primary-container px-6 py-3 rounded-xl font-bold text-body-md hover:bg-white/10 transition-all cursor-pointer">
                Audit My Security
              </button>
            </div>
          </div>

          <div className="relative">
            <div
              className="absolute inset-0 bg-secondary/20 blur-3xl"
              style={{ borderRadius: "50%" }}
            />
            <div className="relative z-10 space-y-4">
              <PhilosophyCard
                icon={ICON_PATHS.security}
                title="Curator Check-in Protocol"
                hint={`${status.curatorsRequired} contacts required to authorize release`}
                help="Number of trusted contacts who must independently confirm before any sealed message is released."
              />
              <PhilosophyCard
                icon={ICON_PATHS.timer}
                title="Heartbeat Interval"
                hint="Currently set to 14 days"
                help="How often the system asks you to confirm you're well. Configurable from Life Check settings."
              />
            </div>
          </div>
        </div>
      </section>

      <ComposeMessageDialog
        open={showCompose}
        onOpenChange={setShowCompose}
        contacts={contacts}
      />
    </div>
  );
}

interface Contact {
  _id: Id<"trusted_contacts">;
  name: string;
  avatarUrl?: string;
}

function FeaturedMessage({
  message,
  contacts,
}: {
  message: {
    _id: Id<"conditional_messages">;
    title: string;
    status: string;
    triggerType: TriggerType;
    recipients: Id<"trusted_contacts">[];
  };
  contacts: Contact[];
}) {
  const recipientContacts = contacts.filter((c) =>
    message.recipients.includes(c._id)
  );
  const visibleRecipients = recipientContacts.slice(0, 2);
  const extraCount = recipientContacts.length - visibleRecipients.length;

  return (
    <article className="md:col-span-8 bg-surface-container p-8 rounded-xl shadow-sm ghost-border">
      <div className="flex justify-between items-start mb-8 gap-4">
        <div className="min-w-0">
          <span className="bg-secondary-fixed text-on-secondary-fixed px-3 py-1 rounded-full text-label-md mb-4 inline-block">
            Primary {message.status.charAt(0).toUpperCase() + message.status.slice(1)}
          </span>
          <h2 className="text-headline-md text-primary break-words">
            &ldquo;{message.title}&rdquo;
          </h2>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            className="p-2 hover:bg-surface-container-high rounded-lg transition-colors cursor-pointer"
            aria-label="Preview message"
          >
            <Icon path={ICON_PATHS.visibility} className="w-5 h-5" />
          </button>
          <button
            className="p-2 hover:bg-surface-container-high rounded-lg transition-colors cursor-pointer"
            aria-label="More options"
          >
            <Icon path={ICON_PATHS.moreVert} className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 border-t border-outline-variant/20 pt-8">
        <div>
          <span className="text-label-md text-on-surface-variant mb-2 block">
            Recipients
          </span>
          {recipientContacts.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">No recipients</p>
          ) : (
            <div className="flex -space-x-2">
              {visibleRecipients.map((c) => (
                <div
                  key={c._id}
                  className="w-8 h-8 border-2 border-surface shadow-sm overflow-hidden"
                  style={{ borderRadius: "50%" }}
                >
                  <UserAvatar
                    size="sm"
                    imageUrl={c.avatarUrl}
                    initials={getInitials(c.name)}
                    alt={c.name}
                    fallbackClassName="bg-primary text-on-primary"
                  />
                </div>
              ))}
              {extraCount > 0 && (
                <div
                  className="w-8 h-8 bg-surface-container-highest border-2 border-surface flex items-center justify-center text-[10px] font-bold"
                  style={{ borderRadius: "50%" }}
                >
                  +{extraCount}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <span className="text-label-md text-on-surface-variant mb-2 block">
            Trigger Protocol
          </span>
          <div className="flex items-center gap-2 text-body-md font-semibold text-primary">
            <Icon
              path={TRIGGER_ICONS[message.triggerType]}
              className="w-4 h-4"
            />
            {TRIGGER_LABELS[message.triggerType]}
          </div>
        </div>

        <div>
          <span className="text-label-md text-on-surface-variant mb-2 flex items-center gap-1.5">
            Encryption
            <HelpHint content="Zero-knowledge: the message was encrypted on your device before being stored. Keeplas servers can never read the contents." />
          </span>
          <div className="flex items-center gap-2 text-body-md font-semibold text-secondary">
            <Icon path={ICON_PATHS.verifiedFill} className="w-4 h-4" />
            Zero-Knowledge Seal
          </div>
        </div>
      </div>
    </article>
  );
}

function SecondaryCard({
  message,
}: {
  message: {
    _id: Id<"conditional_messages">;
    title: string;
    status: string;
    triggerType: TriggerType;
    updatedAt: number;
  };
}) {
  const statusMeta = STATUS_LABELS[message.status] ?? STATUS_LABELS.draft;
  const isActive = message.status === "active";
  const icon = isActive ? ICON_PATHS.familyHistory : ICON_PATHS.historyEdu;

  return (
    <article className="md:col-span-6 bg-surface-container-low p-8 rounded-xl ghost-border">
      <div className="flex justify-between mb-6">
        <span
          className={cn(
            "text-label-md",
            statusMeta.color
          )}
        >
          {statusMeta.label}
        </span>
        <Icon
          path={icon}
          className={cn("w-5 h-5", isActive ? "text-secondary" : "text-outline")}
        />
      </div>
      <h3 className="text-headline-sm text-primary mb-2">
        {message.title}
      </h3>
      <p className="text-body-md text-on-surface-variant mb-6">
        Encrypted under{" "}
        <span className="font-semibold text-primary">
          {TRIGGER_LABELS[message.triggerType]}
        </span>
        .
      </p>
      <div className="flex items-center justify-between pt-6 border-t border-outline-variant/10">
        <span className="text-body-md text-on-surface-variant">
          {isActive
            ? `Release trigger: ${TRIGGER_LABELS[message.triggerType]}`
            : `Last edited: ${formatDate(message.updatedAt)}`}
        </span>
        <button className="text-secondary text-body-md font-bold flex items-center gap-1 cursor-pointer">
          {isActive ? "Manage" : "Resume"}
          <Icon path={ICON_PATHS.chevronRight} className="w-3 h-3" />
        </button>
      </div>
    </article>
  );
}

function PhilosophyCard({
  icon,
  title,
  hint,
  help,
}: {
  icon: string;
  title: string;
  hint: string;
  help?: string;
}) {
  return (
    <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-md border border-white/10">
      <div className="flex gap-4 items-start">
        <div
          className="w-10 h-10 bg-secondary-fixed/20 flex items-center justify-center flex-shrink-0"
          style={{ borderRadius: "50%" }}
        >
          <Icon path={icon} className="w-5 h-5 text-secondary-fixed" />
        </div>
        <div>
          <h4 className="text-headline-sm flex items-center gap-1.5">
            {title}
            {help && (
              <HelpHint
                content={help}
                iconClassName="text-on-primary-container/70 hover:text-secondary-fixed"
              />
            )}
          </h4>
          <p className="text-body-md opacity-70">{hint}</p>
        </div>
      </div>
    </div>
  );
}

interface ContactOption {
  _id: Id<"trusted_contacts">;
  name: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

function ComposeMessageDialog({
  open,
  onOpenChange,
  contacts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: ContactOption[];
}) {
  const create = useMutation(api.conditional_messages.createMessage);
  const { encryptContent, computeHash, isReady } = useVaultCrypto();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerType>("life_check_failure");
  const [releaseDate, setReleaseDate] = useState("");
  const [recipientSelection, setRecipientSelection] = useState<string[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const recipientOptions = useMemo<MultiSelectOption[]>(
    () =>
      contacts.map((c) => ({
        value: c._id,
        label: c.name,
        hint: c.email,
      })),
    [contacts]
  );

  function resetForm() {
    setTitle("");
    setContent("");
    setRecipientSelection([]);
    setTriggerType("life_check_failure");
    setReleaseDate("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady) {
      setError("Encryption key not available. Sign in again.");
      return;
    }
    const plain = htmlToPlainText(content);
    if (!title.trim() || !plain) {
      setError("Title and content are required.");
      return;
    }
    if (recipientSelection.length === 0) {
      setError("Select at least one recipient.");
      return;
    }
    if (triggerType === "time_based" && !releaseDate) {
      setError("Pick a release date.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const encryptedContent = await encryptContent(content);
      const contentHash = await computeHash(content);

      const triggerConfig: {
        releaseDate?: number;
      } = {};
      if (triggerType === "time_based")
        triggerConfig.releaseDate = new Date(releaseDate).getTime();

      await create({
        title: title.trim(),
        encryptedContent,
        contentHash,
        recipients: recipientSelection as Id<"trusted_contacts">[],
        triggerType,
        triggerConfig,
      });

      onOpenChange(false);
      resetForm();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to encrypt message."));
    } finally {
      setSaving(false);
    }
  }

  const visibleTriggers = TRIGGER_OPTIONS.filter((t) => !t.hidden);
  const selectedTrigger = TRIGGER_OPTIONS.find((t) => t.value === triggerType);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[92vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0 static">
            <div>
              <DialogTitle>Compose conditional message</DialogTitle>
              <DialogDescription>
                Encrypted with zero-knowledge before leaving your device.
              </DialogDescription>
            </div>
            <DialogClose className="p-2 hover:bg-surface-container-high rounded-xl transition-colors cursor-pointer">
              <Icon path={ICON_PATHS.close} />
            </DialogClose>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-5 flex-1 overflow-y-auto min-h-0">
            <ErrorAlert message={error} />

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Letter to my children"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Write the message that will be released…"
                minHeight={280}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Trigger
                <HelpHint content="The condition that releases the message: a verified Life-Check failure, a calendar date, or a manual release you (or a curator) approve." />
              </Label>
              <Select<TriggerType>
                value={triggerType}
                onValueChange={(v) => setTriggerType(v)}
                placeholder="Choose a trigger"
              >
                {visibleTriggers.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.comingSoon}
                    label={opt.label}
                    description={opt.hint}
                  >
                    <span className="flex items-center justify-between gap-3 w-full">
                      <span>{opt.label}</span>
                      {opt.comingSoon && (
                        <span className="text-[10px] uppercase tracking-wide bg-surface-container-high text-outline px-1.5 py-0.5 rounded">
                          Soon
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </Select>
              {selectedTrigger && (
                <p className="text-label-md text-on-surface-variant">
                  {selectedTrigger.hint}
                </p>
              )}
            </div>

            {triggerType === "life_check_failure" && (
              <InfoCallout icon={ICON_PATHS.heartbeat}>
                Uses your global Life Check cadence and escalation. Adjust the
                inactivity threshold once in{" "}
                <Link
                  href="/life-check"
                  className="text-secondary font-semibold hover:underline"
                >
                  Life Check settings
                </Link>
                — it applies to every message with this trigger.
              </InfoCallout>
            )}

            {triggerType === "time_based" && (
              <div className="space-y-2">
                <Label>Release on</Label>
                <DatePicker
                  value={releaseDate}
                  onChange={setReleaseDate}
                  min={new Date().toISOString().split("T")[0]}
                  placeholder="Pick a release date"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-label-md text-on-surface-variant flex items-center gap-1.5">
                Who receives this at trigger?
                <HelpHint content="Trusted contacts who will receive this message when the trigger fires. Each gets their own wrapped decryption key." />
              </Label>
              <MultiSelect
                options={recipientOptions}
                selected={recipientSelection}
                onChange={setRecipientSelection}
                placeholder="No one selected"
                searchPlaceholder="Search contacts…"
                emptyMessage="No contacts match."
                renderTrigger={(selected) => {
                  if (selected.length === 0) {
                    return (
                      <span className="text-outline-variant">
                        No one selected
                      </span>
                    );
                  }
                  const labels = selected
                    .map(
                      (v) => recipientOptions.find((o) => o.value === v)?.label
                    )
                    .filter(Boolean);
                  return (
                    <span className="truncate">{labels.join(", ")}</span>
                  );
                }}
                footer={(close) => (
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      setShowInvite(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-secondary text-label-md hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    <Icon path={ICON_PATHS.userPlus} className="w-4 h-4" />
                    Add new contact
                  </button>
                )}
              />
              <p className="text-label-md text-on-surface-variant/70">
                Each recipient gets their own wrapped decryption key.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => onOpenChange(false)}
                className="flex-1 bg-surface-container-low hover:bg-surface-container-high cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="vault"
                size="md"
                disabled={saving || !isReady}
                className="flex-1 cursor-pointer"
              >
                {saving ? "Encrypting..." : "Encrypt & Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <InviteContactDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        onContactInvited={(contactId) => {
          setRecipientSelection((prev) =>
            prev.includes(contactId) ? prev : [...prev, contactId]
          );
        }}
      />
    </>
  );
}
