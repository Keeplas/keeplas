"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  Button,
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
  Icon,
  Input,
  Label,
  Loader,
  Select,
  SelectItem,
  Textarea,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { useVaultCrypto } from "@/lib/use-vault-crypto";
import { getErrorMessage } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/format";
import type { Id } from "@keeplas/backend/_generated/dataModel";

type TriggerType =
  | "life_check_failure"
  | "time_based"
  | "age_based"
  | "legal_event"
  | "manual";

const TRIGGER_LABELS: Record<TriggerType, string> = {
  life_check_failure: "Verified Life-Check Failure",
  time_based: "Time-based Release",
  age_based: "Recipient Age",
  legal_event: "Verified Legal Event",
  manual: "Manual Trigger",
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-surface-container-high text-on-surface-variant" },
  active: { label: "Primary Active", className: "bg-secondary text-on-secondary" },
  sealed: { label: "Sealed", className: "bg-tertiary text-on-tertiary" },
  released: { label: "Released", className: "bg-error text-on-error" },
  cancelled: { label: "Cancelled", className: "bg-surface-container text-on-surface-variant line-through" },
};

export default function ConditionalMessagesPage() {
  const messages = useQuery(api.conditional_messages.listMessages);
  const status = useQuery(api.conditional_messages.getDeadManStatus);
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const setStatus = useMutation(api.conditional_messages.setMessageStatus);
  const deleteMessage = useMutation(api.conditional_messages.deleteMessage);

  const [showCompose, setShowCompose] = useState(false);

  if (messages === undefined || status === undefined) {
    return <Loader fullscreen label="Loading conditional messages" />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <h1 className="font-headline text-primary text-3xl md:text-4xl font-extrabold tracking-tight">
            Conditional Messages
          </h1>
          <p className="text-on-surface-variant text-sm md:text-base max-w-md">
            Encrypted letters and instructions released by life events or time triggers.
          </p>
        </div>

        <div
          className={cn(
            "rounded-2xl px-5 py-4 text-on-primary min-w-[260px]",
            status?.isActive ? "vault-gradient" : "bg-tertiary"
          )}
        >
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-80">
            Dead Man Switch
          </p>
          <p className="font-headline text-xl font-extrabold mt-1">
            {status?.isActive ? "Active" : "Inactive"}
          </p>
          <p className="text-xs opacity-80 mt-1">
            Last heartbeat{" "}
            {status?.lastHeartbeatAt ? formatTimeAgo(status.lastHeartbeatAt) : "—"}.
          </p>
        </div>
      </header>

      <div className="bg-surface-container-low rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-on-surface-variant font-medium">
            Draft a New Legacy
          </p>
          <p className="text-on-surface mt-1 max-w-md">
            Write encrypted instructions or letters that release only when conditions are met.
          </p>
        </div>
        <Button variant="vault" size="md" onClick={() => setShowCompose(true)}>
          <Icon path={ICON_PATHS.plus} className="w-4 h-4" />
          Compose Message
        </Button>
      </div>

      {messages.length === 0 ? (
        <div className="bg-surface-container-low rounded-3xl p-12 text-center text-on-surface-variant">
          No conditional messages yet. Compose your first one above.
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {messages.map((msg) => {
            const badge = STATUS_BADGES[msg.status];
            return (
              <li
                key={msg._id}
                className="bg-surface-container-low rounded-3xl p-6 flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={cn(
                        "inline-block text-[10px] uppercase tracking-[0.2em] font-bold px-2.5 py-1 rounded-full",
                        badge?.className
                      )}
                    >
                      {badge?.label ?? msg.status}
                    </span>
                    <h3 className="font-headline text-lg font-bold text-on-surface mt-3">
                      {msg.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => deleteMessage({ messageId: msg._id })}
                    className="text-xs text-error hover:underline cursor-pointer"
                  >
                    Delete
                  </button>
                </div>

                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-on-surface-variant">Trigger</dt>
                    <dd className="text-on-surface font-medium">
                      {TRIGGER_LABELS[msg.triggerType]}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-on-surface-variant">Recipients</dt>
                    <dd className="text-on-surface font-medium">{msg.recipients.length}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-on-surface-variant">Curators required</dt>
                    <dd className="text-on-surface font-medium">{msg.curatorsRequired}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-on-surface-variant">Created</dt>
                    <dd className="text-on-surface font-medium">{formatTimeAgo(msg.createdAt)}</dd>
                  </div>
                </dl>

                <div className="flex gap-2 pt-2 border-t border-outline-variant/15">
                  {msg.status === "active" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStatus({ messageId: msg._id, status: "sealed" })}
                    >
                      Seal
                    </Button>
                  )}
                  {msg.status === "draft" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStatus({ messageId: msg._id, status: "active" })}
                    >
                      Activate
                    </Button>
                  )}
                  {msg.status !== "cancelled" && msg.status !== "released" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStatus({ messageId: msg._id, status: "cancelled" })}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ComposeMessageDialog
        open={showCompose}
        onOpenChange={setShowCompose}
        contacts={contacts ?? []}
      />
    </div>
  );
}

interface ContactOption {
  _id: Id<"trusted_contacts">;
  name: string;
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
  const [inactivityDays, setInactivityDays] = useState(30);
  const [releaseDate, setReleaseDate] = useState("");
  const [recipientAge, setRecipientAge] = useState(21);
  const [legalDesc, setLegalDesc] = useState("");
  const [recipients, setRecipients] = useState<Set<Id<"trusted_contacts">>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleRecipient(id: Id<"trusted_contacts">) {
    setRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady) {
      setError("Encryption key not available. Sign in again.");
      return;
    }
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.");
      return;
    }
    if (recipients.size === 0) {
      setError("Select at least one recipient.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const encryptedContent = await encryptContent(content);
      const contentHash = await computeHash(content);

      const triggerConfig: {
        inactivityDays?: number;
        releaseDate?: number;
        recipientAge?: number;
        legalEventDesc?: string;
      } = {};
      if (triggerType === "life_check_failure") triggerConfig.inactivityDays = inactivityDays;
      if (triggerType === "time_based" && releaseDate)
        triggerConfig.releaseDate = new Date(releaseDate).getTime();
      if (triggerType === "age_based") triggerConfig.recipientAge = recipientAge;
      if (triggerType === "legal_event") triggerConfig.legalEventDesc = legalDesc.trim();

      await create({
        title: title.trim(),
        encryptedContent,
        contentHash,
        recipients: Array.from(recipients),
        triggerType,
        triggerConfig,
      });

      onOpenChange(false);
      setTitle("");
      setContent("");
      setRecipients(new Set());
    } catch (err) {
      setError(getErrorMessage(err, "Failed to encrypt message."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the message that will be released..."
              rows={6}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Trigger</Label>
            <Select<TriggerType>
              value={triggerType}
              onValueChange={(v) => setTriggerType(v)}
              placeholder="Choose a trigger"
            >
              {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key as TriggerType}>
                  {label}
                </SelectItem>
              ))}
            </Select>
          </div>

          {triggerType === "life_check_failure" && (
            <div className="space-y-2">
              <Label>Inactivity threshold (days)</Label>
              <Input
                type="number"
                min={1}
                value={inactivityDays}
                onChange={(e) => setInactivityDays(Number(e.target.value))}
              />
            </div>
          )}

          {triggerType === "time_based" && (
            <div className="space-y-2">
              <Label>Release on</Label>
              <Input
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
              />
            </div>
          )}

          {triggerType === "age_based" && (
            <div className="space-y-2">
              <Label>Recipient age</Label>
              <Input
                type="number"
                min={1}
                value={recipientAge}
                onChange={(e) => setRecipientAge(Number(e.target.value))}
              />
            </div>
          )}

          {triggerType === "legal_event" && (
            <div className="space-y-2">
              <Label>Legal event description</Label>
              <Input
                value={legalDesc}
                onChange={(e) => setLegalDesc(e.target.value)}
                placeholder="e.g., Death certificate filed"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Recipients</Label>
            {contacts.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                No trusted contacts yet. Add some in Trusted Contacts.
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {contacts.map((contact) => (
                  <button
                    key={contact._id}
                    type="button"
                    onClick={() => toggleRecipient(contact._id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-xl text-sm flex items-center justify-between transition-colors cursor-pointer",
                      recipients.has(contact._id)
                        ? "bg-secondary text-on-secondary"
                        : "bg-surface-container hover:bg-surface-container-high"
                    )}
                  >
                    <span>{contact.name}</span>
                    {recipients.has(contact._id) && (
                      <Icon path={ICON_PATHS.checkCircle} className="w-4 h-4" />
                    )}
                  </button>
                ))}
              </div>
            )}
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
  );
}
