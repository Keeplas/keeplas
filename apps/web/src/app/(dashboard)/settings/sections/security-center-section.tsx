"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { cn, Icon, Loader, UserAvatar } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { formatTimeAgo } from "@/lib/format";
import { getInitials } from "@/lib/user";
import { DeviceUnlockManager } from "./device-unlock-manager";
import { PasskeyManager } from "./passkey-manager";
import { TotpManager } from "./totp-manager";
import { RedistributeShardsCard } from "./redistribute-shards-card";

const ACTION_ICONS: Record<string, string> = {
  vault_item_created: ICON_PATHS.lock,
  vault_item_updated: ICON_PATHS.lock,
  vault_item_archived: ICON_PATHS.archive,
  contact_invited: ICON_PATHS.userPlus,
  contact_confirmed: ICON_PATHS.users,
  life_check_validated: ICON_PATHS.heartbeat,
  life_check_configured: ICON_PATHS.heartbeat,
  life_check_postponed: ICON_PATHS.heartbeat,
  travel_mode_enabled: ICON_PATHS.heartbeat,
  travel_mode_disabled: ICON_PATHS.heartbeat,
  scenario_created: ICON_PATHS.shieldCheck,
  scenario_step_added: ICON_PATHS.plus,
  scenario_step_removed: ICON_PATHS.close,
  scenario_paused: ICON_PATHS.warning,
  scenario_armed: ICON_PATHS.shieldCheck,
  conditional_message_created: ICON_PATHS.notes,
  conditional_message_deleted: ICON_PATHS.close,
};

function humanizeAction(action: string): string {
  return action
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

const TOTAL_GUARDIAN_SLOTS = 5;

export function SecurityCenterSection() {
  const summary = useQuery(api.audit.getSecuritySummary);
  const logs = useQuery(api.audit.listLogs, { limit: 50 });
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const user = useQuery(api.users.viewer);

  if (
    summary === undefined ||
    logs === undefined ||
    contacts === undefined ||
    user === undefined
  ) {
    return <Loader label="Loading Security Center" />;
  }

  const accepted = (contacts ?? []).filter((c) => c.invitationStatus === "accepted");
  const pending = (contacts ?? []).filter((c) => c.invitationStatus === "pending");
  const guardianSlots = Array.from({ length: TOTAL_GUARDIAN_SLOTS }, (_, i) => {
    const real = contacts?.[i];
    return real ?? null;
  });

  const hasKeeplasShard = !!user?.keeplasShard;
  const hasRecoveryHash = !!user?.recoveryPhraseHash;

  const lastAccessTs = user?.lastSeenAt ?? user?._creationTime ?? null;
  const lastAccessLog =
    logs.find((l) => (l.country && l.country !== "XX") || l.deviceInfo) ?? null;

  return (
    <div className="space-y-10">
      <LastAccessPanel
        lastSeenAt={lastAccessTs}
        country={lastAccessLog?.country ?? null}
        deviceInfo={lastAccessLog?.deviceInfo ?? null}
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Social Recovery */}
        <section className="md:col-span-8 bg-surface-container-lowest p-6 md:p-8 rounded-2xl ghost-border flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
              <div>
                <h2 className="text-headline-md text-primary mb-2">
                  Social Recovery
                </h2>
                <p className="text-label-md text-secondary">
                  {accepted.length > 0
                    ? "Status: Active & Secure"
                    : "Status: Awaiting Guardians"}
                </p>
              </div>
              <div className="bg-secondary-container text-on-secondary-container px-4 py-2 rounded-full text-body-md font-bold whitespace-nowrap">
                {accepted.length} of {TOTAL_GUARDIAN_SLOTS} Guardians Verified
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
              {guardianSlots.map((contact, i) => {
                if (contact) {
                  const verified = contact.invitationStatus === "accepted";
                  return (
                    <div
                      key={contact._id}
                      className={cn(
                        "flex flex-col items-center space-y-3",
                        !verified && "opacity-60"
                      )}
                    >
                      <div
                        className={cn(
                          "w-14 h-14 flex items-center justify-center border-4 overflow-hidden",
                          verified
                            ? "bg-primary border-secondary-fixed"
                            : "bg-surface-container-high border-outline-variant"
                        )}
                        style={{ borderRadius: "50%" }}
                      >
                        <UserAvatar
                          size="md"
                          imageUrl={contact.avatarUrl}
                          initials={getInitials(contact.name)}
                          alt={contact.name}
                          fallbackClassName={
                            verified
                              ? "bg-primary text-on-primary"
                              : "bg-surface-container-high text-outline"
                          }
                        />
                      </div>
                      <span
                        className={cn(
                          "text-label-md text-center truncate max-w-[80px]",
                          verified ? "text-primary" : "text-outline"
                        )}
                      >
                        {contact.name.split(" ")[0]}
                        {contact.name.split(" ")[1]
                          ? ` ${contact.name.split(" ")[1].charAt(0)}.`
                          : ""}
                      </span>
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    className="flex flex-col items-center space-y-3 opacity-40 grayscale"
                  >
                    <div
                      className="w-14 h-14 bg-surface-dim flex items-center justify-center border-4 border-outline-variant"
                      style={{ borderRadius: "50%" }}
                    >
                      <Icon path={ICON_PATHS.person} className="w-6 h-6 text-outline" />
                    </div>
                    <span className="text-label-md text-outline">Pending...</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/trusted-contacts"
              className="bg-surface-container-highest hover:bg-surface-variant text-primary px-5 py-2.5 rounded-xl text-body-md font-bold transition-all flex items-center justify-center space-x-2"
            >
              <Icon path={ICON_PATHS.mail} className="w-4 h-4" />
              <span>{pending.length > 0 ? "Resend Invites" : "Invite Guardian"}</span>
            </Link>
            <Link
              href="/trusted-contacts"
              className="text-secondary hover:underline px-5 py-2.5 text-body-md font-bold transition-all text-center"
            >
              Manage Guardian Rules
            </Link>
          </div>
        </section>

        {/* Recovery Kit shortcut */}
        <section className="md:col-span-4 bg-primary-container text-on-primary-container p-6 md:p-8 rounded-2xl flex flex-col justify-between">
          <div>
            <Icon
              path={ICON_PATHS.description}
              className="w-10 h-10 mb-5 text-secondary-fixed"
            />
            <h2 className="text-headline-md text-white mb-3">
              Recovery Kit
            </h2>
            <p className="text-body-md text-on-primary-container mb-6">
              Generate a physical, offline recovery sheet containing encrypted metadata
              shards for your vault.
            </p>
          </div>
          <Link
            href="/settings/recovery-kit"
            className="vault-gradient text-white w-full py-3 rounded-xl font-bold flex items-center justify-center space-x-3 shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
          >
            <Icon path={ICON_PATHS.print} className="w-5 h-5" />
            <span>Print Physical Kit</span>
          </Link>
        </section>

        {/* Master Recovery / Shamir */}
        <section className="md:col-span-12 bg-surface-container p-6 md:p-8 rounded-2xl">
          <div className="flex items-center space-x-3 mb-5">
            <Icon path={ICON_PATHS.hub} className="w-6 h-6 text-secondary" />
            <h2 className="text-headline-md text-primary">
              Master Recovery
            </h2>
          </div>
          <p className="text-body-md text-on-surface-variant mb-6">
            Your master key is split into{" "}
            <strong className="text-primary">5 cryptographic shards</strong> using
            Shamir&apos;s Secret Sharing. You chose a threshold of{" "}
            <strong className="text-primary">{user?.vaultThreshold ?? 2}</strong>{" "}
            shards to reconstruct the vault. Any combination meeting that
            threshold works — your contacts collaborate on-device, never on
            the server.
          </p>

          <div className="space-y-3">
            <ShardRow
              icon={ICON_PATHS.key}
              label="Recovery phrase"
              hint={hasRecoveryHash ? "Hashed and verified" : "Not generated yet"}
              verified={hasRecoveryHash}
            />
            <ShardRow
              icon={ICON_PATHS.cloud}
              label="Keeplas backup shard"
              hint={
                hasKeeplasShard ? "Encrypted in trusted cloud" : "Awaiting key generation"
              }
              verified={hasKeeplasShard}
            />
            {accepted.slice(0, 2).map((c, i) => (
              <ShardRow
                key={c._id}
                icon={ICON_PATHS.users}
                label={`Guardian shard #${i + 3}`}
                hint={`Held by ${c.name.split(" ")[0]}`}
                verified
              />
            ))}
            <Link
              href="/trusted-contacts"
              className="w-full p-3.5 border-2 border-dashed border-outline-variant rounded-xl flex items-center justify-center space-x-2 text-on-surface-variant hover:bg-surface-container-low transition-colors"
            >
              <Icon path={ICON_PATHS.plus} className="w-5 h-5" />
              <span className="text-body-md font-bold">Configure Additional Shard</span>
            </Link>
          </div>
        </section>

        <div className="md:col-span-12">
          <RedistributeShardsCard />
        </div>

        <DeviceUnlockManager />
        <PasskeyManager />
        <TotpManager />
      </div>

      {/* Activity Log */}
      <section className="bg-surface-container-lowest p-6 md:p-8 rounded-2xl ghost-border">
        <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
          <div className="flex items-center space-x-3">
            <Icon path={ICON_PATHS.shieldCheck} className="w-6 h-6 text-secondary" />
            <h2 className="text-headline-md text-primary">Activity Log</h2>
          </div>
          <span className="text-label-md text-on-surface-variant">
            Hash-chained · {logs.length} entries
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <SummaryStat label="Total events" value={summary?.totalEvents ?? 0} />
          <SummaryStat
            label="Last activity"
            value={summary?.lastEventAt ? formatTimeAgo(summary.lastEventAt) : "—"}
          />
          <SummaryStat
            label="Pending access"
            value={summary?.pendingAccessRequests ?? 0}
          />
          <SummaryStat
            label="Approved access"
            value={summary?.approvedAccessRequests ?? 0}
          />
        </div>

        {logs.length === 0 ? (
          <p className="text-body-lg text-on-surface-variant text-center py-12">
            No events recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant/15 max-h-96 overflow-y-auto">
            {logs.map((log) => {
              const iconPath = ACTION_ICONS[log.action] ?? ICON_PATHS.shieldCheck;
              return (
                <li key={log._id} className="py-3 flex items-start gap-3">
                  <span
                    className={cn(
                      "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center",
                      log.actorType === "system"
                        ? "bg-tertiary/15 text-tertiary"
                        : log.actorType === "trusted_contact"
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary/15 text-secondary"
                    )}
                  >
                    <Icon path={iconPath} className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md font-medium text-on-surface">
                      {humanizeAction(log.action)}
                    </p>
                    <p className="text-body-md text-on-surface-variant truncate">
                      {log.resourceType} · actor: {log.actorType}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-body-md text-on-surface-variant">
                      {formatTimeAgo(log.createdAt)}
                    </p>
                    <p className="text-label-md font-mono text-outline-variant truncate max-w-[120px]">
                      #{log.logHash}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ShardRow({
  icon,
  label,
  hint,
  verified,
}: {
  icon: string;
  label: string;
  hint: string;
  verified: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3.5 bg-surface-container-lowest rounded-xl">
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
          <Icon path={icon} className="w-5 h-5" />
        </div>
        <div>
          <p className="text-body-md font-bold text-primary">{label}</p>
          <p className="text-body-md text-on-surface-variant">{hint}</p>
        </div>
      </div>
      <Icon
        path={ICON_PATHS.checkCircle}
        className={cn(
          "w-5 h-5",
          verified ? "text-secondary-fixed-dim" : "text-outline-variant/40"
        )}
      />
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-container rounded-xl p-3.5">
      <p className="text-label-md text-on-surface-variant">
        {label}
      </p>
      <p className="text-headline-sm text-primary mt-1">{value}</p>
    </div>
  );
}

function LastAccessPanel({
  lastSeenAt,
  country,
  deviceInfo,
}: {
  lastSeenAt: number | null;
  country: string | null;
  deviceInfo: string | null;
}) {
  if (!lastSeenAt) return null;

  const date = new Date(lastSeenAt);
  const isToday = new Date().toDateString() === date.toDateString();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const headline = isToday
    ? `Today, ${time}`
    : `${date.toLocaleDateString([], { weekday: "short", month: "short", day: "2-digit" })} · ${time}`;

  const subtitleParts = [
    country && country !== "XX" ? `from ${country}` : null,
    deviceInfo,
  ].filter(Boolean) as string[];
  const subtitle =
    subtitleParts.length > 0
      ? subtitleParts.join(" · ")
      : "Verified device · Zero-Knowledge session";

  return (
    <section className="bg-surface-container-lowest p-6 md:p-8 rounded-2xl ghost-border flex items-center gap-4">
      <div className="bg-secondary/15 text-secondary w-11 h-11 rounded-xl flex items-center justify-center shrink-0">
        <Icon path={ICON_PATHS.history} className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-label-md text-on-surface-variant">Last access</p>
        <p className="text-headline-sm text-primary">{headline}</p>
        <p className="text-body-md text-on-surface-variant mt-0.5 truncate">
          {subtitle}
        </p>
      </div>
    </section>
  );
}
