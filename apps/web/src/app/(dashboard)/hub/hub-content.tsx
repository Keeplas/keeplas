"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  buttonVariants,
  cn,
  Icon,
  InfoCallout,
  Loader,
  UserAvatar,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { LEGACY_TIPS, tipHref } from "@/lib/legacy-tips";
import { getCategoryConfig, type VaultCategory } from "@/lib/vault-categories";
import { getInitials } from "@/lib/user";
import { formatTimeAgo } from "@/lib/format";

const ASSET_CATEGORIES: VaultCategory[] = ["financial_asset", "digital_asset"];
const DIRECTIVE_CATEGORIES: VaultCategory[] = [
  "health_directive",
  "legal_document",
];
const DOCUMENT_CATEGORIES: VaultCategory[] = [
  "personal_document",
  "business_continuity",
  "credential",
];

const ACTION_ICONS: Record<string, string> = {
  add_item: ICON_PATHS.archive,
  invite_contact: ICON_PATHS.userPlus,
  life_check: ICON_PATHS.heartbeat,
  two_factor: ICON_PATHS.key,
  verify_whatsapp: ICON_PATHS.phone,
  more_categories: ICON_PATHS.plus,
};

export function HubContent() {
  const items = useQuery(api.vault_items.getItems);
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const hubData = useQuery(api.hub.getHubData);

  if (items === undefined || contacts === undefined || hubData === undefined) {
    return <Loader fullscreen label="Loading Hub" />;
  }

  if (hubData === null) return null;

  const assets = items.filter((i) =>
    ASSET_CATEGORIES.includes(i.category as VaultCategory),
  );
  const directives = items.filter((i) =>
    DIRECTIVE_CATEGORIES.includes(i.category as VaultCategory),
  );
  const documents = items.filter((i) =>
    DOCUMENT_CATEGORIES.includes(i.category as VaultCategory),
  );

  const { continuityScore } = hubData;
  const scoreLabel =
    continuityScore >= 75
      ? "Strong Protection"
      : continuityScore >= 40
        ? "Partial Coverage"
        : "Action Required";

  const missingDirectives = directives.length === 0;

  return (
    <div className="max-w-screen-2xl mx-auto">
      {/* Header */}
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-headline-lg text-primary mb-2">Hub</h1>
          <p className="text-body-lg text-secondary max-w-lg text-balance">
            Your central command for protected legacy
            <br />
            and continuity readiness.
          </p>
        </div>

        <a
          href="#priority-actions"
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          aria-label="Jump to priority actions"
        >
          <ContinuityScoreBadge score={continuityScore} label={scoreLabel} />
        </a>
      </header>

      {/* Life Map Canvas */}
      <div
        className="relative md:min-h-[700px] bg-surface-container-low rounded-[2rem] overflow-hidden p-4 md:p-8 mb-12 flex flex-col gap-4 md:block"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(40, 101, 122, 0.25) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {/* Center Node */}
        <div className="self-center md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:z-20">
          <div
            className="w-40 h-40 md:w-48 md:h-48 bg-primary flex flex-col items-center justify-center text-white shadow-2xl p-6 text-center border-8 border-surface-container-low"
            style={{ borderRadius: "50%" }}
          >
            <Icon path={ICON_PATHS.fingerprint} className="w-10 h-10 mb-2" />
            <p className="text-headline-sm uppercase tracking-wide">
              Your Legacy
            </p>
            <p className="text-label-md text-secondary-fixed mt-1">
              Central Node
            </p>
          </div>
        </div>

        {/* Assets — top left */}
        <NodeCard
          iconPath={ICON_PATHS.accountBalance}
          title="Assets"
          position="md:top-10 md:left-10 lg:left-24"
          status="protected"
          href="/vault"
        >
          {assets.length === 0 ? (
            <p className="text-body-md text-on-surface-variant mt-2">
              No assets recorded yet.
            </p>
          ) : (
            <div className="space-y-3 mt-4">
              {assets.slice(0, 3).map((a) => (
                <div
                  key={a._id}
                  className="flex justify-between items-center text-body-md"
                >
                  <span className="text-on-surface-variant truncate">
                    {a.title}
                  </span>
                  <Icon
                    path={ICON_PATHS.checkCircle}
                    className="w-3.5 h-3.5 text-secondary shrink-0 ml-2"
                  />
                </div>
              ))}
            </div>
          )}
        </NodeCard>

        {/* Contacts — bottom left */}
        <NodeCard
          iconPath={ICON_PATHS.group}
          title="Contacts"
          position="md:bottom-10 md:left-10 lg:left-24"
          status="protected"
          href="/trusted-contacts"
        >
          {contacts.length === 0 ? (
            <p className="text-body-md text-on-surface-variant mt-2">
              No guardians linked yet.
            </p>
          ) : (
            <>
              <div className="flex -space-x-2 mt-4 mb-3">
                {contacts.slice(0, 3).map((c) => (
                  <UserAvatar
                    key={c._id}
                    size="md"
                    imageUrl={c.avatarUrl}
                    initials={getInitials(c.name)}
                    alt={c.name}
                    className="ring-2 ring-surface"
                    imageClassName="ring-2 ring-surface"
                    fallbackClassName="bg-secondary-container text-on-secondary-container"
                  />
                ))}
                {contacts.length > 3 && (
                  <div className="w-10 h-10 rounded-full ring-2 ring-surface bg-surface-container-high flex items-center justify-center font-headline font-bold text-sm text-on-surface-variant">
                    +{contacts.length - 3}
                  </div>
                )}
              </div>
              <p className="text-label-md text-on-surface-variant">
                {contacts.length} Primary Guardian
                {contacts.length > 1 ? "s" : ""} Linked
              </p>
            </>
          )}
        </NodeCard>

        {/* Directives — top right */}
        <div className="md:absolute md:top-10 md:right-10 lg:right-24">
          <Link
            href="/vault?section=documents"
            className={cn(
              "block p-6 w-full md:w-64 relative shadow-xl hover:shadow-2xl md:hover:-translate-y-1 transition-all duration-500 cursor-pointer",
              missingDirectives
                ? "bg-surface-container border-2 border-error/20"
                : "bg-surface-container-lowest border border-secondary/10",
            )}
            style={{ borderRadius: "2rem" }}
          >
            {missingDirectives && (
              <div className="absolute -top-3 -right-3 bg-error text-white text-label-md px-3 py-1 rounded-full animate-pulse">
                Action Required
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <div
                className={cn(
                  "w-12 h-12 flex items-center justify-center",
                  missingDirectives
                    ? "bg-error/10 text-error"
                    : "bg-secondary-container/30 text-secondary",
                )}
                style={{ borderRadius: "1rem" }}
              >
                <Icon
                  path={ICON_PATHS.medicalInformation}
                  className="w-6 h-6"
                />
              </div>
              <span
                className={cn(
                  "text-label-md px-2 py-1 rounded",
                  missingDirectives
                    ? "text-error bg-error/10"
                    : "text-secondary bg-secondary-container/20",
                )}
              >
                {missingDirectives ? "Unmapped" : "Protected"}
              </span>
            </div>
            <h3 className="text-headline-sm text-primary mb-1">Directives</h3>
            {missingDirectives ? (
              <>
                <p className="text-body-md text-on-surface-variant mt-2">
                  Medical POA and Advance Directives are currently missing or
                  expired.
                </p>
                <span className="mt-4 w-full py-2 bg-error text-white rounded-lg text-body-md font-bold transition-transform active:scale-95 flex items-center justify-center">
                  Update Now
                </span>
              </>
            ) : (
              <div className="space-y-3 mt-4">
                {directives.slice(0, 3).map((d) => (
                  <div
                    key={d._id}
                    className="flex justify-between items-center text-body-md"
                  >
                    <span className="text-on-surface-variant truncate">
                      {d.title}
                    </span>
                    <Icon
                      path={ICON_PATHS.checkCircle}
                      className="w-3.5 h-3.5 text-secondary shrink-0 ml-2"
                    />
                  </div>
                ))}
              </div>
            )}
          </Link>
        </div>

        {/* Documents — bottom right */}
        <div className="md:absolute md:bottom-10 md:right-10 lg:right-24">
          <Link
            href="/vault?section=documents"
            className="block bg-surface-container-lowest p-6 w-full md:w-64 shadow-xl hover:shadow-2xl md:hover:-translate-y-1 transition-all duration-500 border border-secondary/10 cursor-pointer"
            style={{ borderRadius: "2rem" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className="w-12 h-12 bg-secondary-container/30 text-secondary flex items-center justify-center"
                style={{ borderRadius: "1rem" }}
              >
                <Icon path={ICON_PATHS.description} className="w-6 h-6" />
              </div>
              <span className="text-label-md text-secondary bg-secondary-container/20 px-2 py-1 rounded">
                {documents.length > 0 ? "Protected" : "Empty"}
              </span>
            </div>
            <h3 className="font-headline font-bold text-primary mb-1">
              Documents
            </h3>
            {documents.length === 0 ? (
              <p className="text-body-md text-on-surface-variant mt-2">
                No documents stored yet.
              </p>
            ) : (
              <div className="space-y-3 mt-4">
                {documents.slice(0, 3).map((d) => (
                  <div
                    key={d._id}
                    className="flex justify-between items-center text-body-md"
                  >
                    <span className="text-on-surface-variant truncate">
                      {d.title}
                    </span>
                    <Icon
                      path={ICON_PATHS.checkCircle}
                      className="w-3.5 h-3.5 text-secondary shrink-0 ml-2"
                    />
                  </div>
                ))}
              </div>
            )}
          </Link>
        </div>

        {/* Decorative connection lines (desktop only) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20 hidden md:block">
          <line
            stroke="#041632"
            strokeDasharray="8 8"
            strokeWidth="2"
            x1="25%"
            x2="50%"
            y1="20%"
            y2="50%"
          />
          <line
            stroke="#041632"
            strokeDasharray="8 8"
            strokeWidth="2"
            x1="25%"
            x2="50%"
            y1="80%"
            y2="50%"
          />
          <line
            stroke={missingDirectives ? "#ba1a1a" : "#041632"}
            strokeDasharray={missingDirectives ? "4 4" : "8 8"}
            strokeWidth="2"
            x1="75%"
            x2="50%"
            y1="20%"
            y2="50%"
          />
          <line
            stroke="#041632"
            strokeDasharray="8 8"
            strokeWidth="2"
            x1="75%"
            x2="50%"
            y1="80%"
            y2="50%"
          />
        </svg>
      </div>

      {/* Priority Actions + Recent Activity (50/50 desktop) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Priority Actions */}
        <div
          id="priority-actions"
          className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm scroll-mt-24"
        >
          <h4 className="text-label-md text-on-surface-variant mb-6">
            Priority Actions
          </h4>
          <div className="space-y-2">
            {hubData.priorityActions.map((action) => (
              <Link
                key={action.key}
                href={action.href}
                className={cn(
                  "flex items-center justify-between p-4 transition-colors rounded-xl group cursor-pointer",
                  action.done
                    ? "bg-surface-container-low/50 hover:bg-surface-container-low"
                    : "bg-error/10 hover:bg-error/15",
                )}
              >
                <span
                  className={cn(
                    "flex items-center gap-3 font-headline font-bold text-sm",
                    action.done
                      ? "text-on-surface-variant line-through decoration-on-surface-variant/40"
                      : "text-error",
                  )}
                >
                  <span
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center shadow-sm",
                      action.done
                        ? "bg-secondary-container/30"
                        : "bg-surface-container-lowest",
                    )}
                  >
                    <Icon
                      path={
                        action.done
                          ? ICON_PATHS.checkCircle
                          : (ACTION_ICONS[action.key] ?? ACTION_ICONS.add_item)
                      }
                      className={cn(
                        "w-4 h-4",
                        action.done ? "text-secondary" : "text-error",
                      )}
                    />
                  </span>
                  {action.label}
                </span>
                <Icon
                  path={ICON_PATHS.chevronRight}
                  className={cn(
                    "w-5 h-5 transition-transform",
                    action.done
                      ? "text-outline-variant/40"
                      : "text-outline-variant group-hover:translate-x-1",
                  )}
                />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-label-md text-on-surface-variant">
              Recent Activity
            </h4>
            {hubData.totalItems > 0 && (
              <Link
                href="/vault"
                className="text-xs text-secondary font-bold cursor-pointer hover:underline"
              >
                View all
              </Link>
            )}
          </div>
          {hubData.recentItems.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-on-surface-variant mb-4">
                No items in your vault yet.
              </p>
              <Link
                href="/vault"
                className={buttonVariants({ variant: "vault", size: "sm" })}
              >
                Add your first item
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {hubData.recentItems.map((item) => {
                const cat = getCategoryConfig(item.category);
                return (
                  <Link
                    key={item._id}
                    href={`/vault/${item._id}`}
                    className="flex items-center gap-3 p-4 bg-surface-container-low hover:bg-surface-container transition-colors rounded-xl group cursor-pointer"
                  >
                    <span className="w-9 h-9 rounded-lg bg-surface-container-lowest flex items-center justify-center shadow-sm shrink-0">
                      <Icon
                        path={cat.icon}
                        className="w-4 h-4 text-secondary"
                      />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-headline font-bold text-primary truncate">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                        {cat.label} · {formatTimeAgo(item.updatedAt)}
                      </p>
                    </div>
                    <Icon
                      path={ICON_PATHS.chevronRight}
                      className="w-5 h-5 text-outline-variant group-hover:translate-x-1 transition-transform"
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Reflect & Prepare — reflection, pain points, emergency advice, education */}
      <section className="mt-12">
        <header className="mb-6">
          <h4 className="text-label-md text-on-surface-variant">
            Reflect & Prepare
          </h4>
          <p className="text-body-md text-on-surface-variant/80 mt-1">
            A few honest questions, real pain points, and practical steps for
            continuity — inside Keeplas and beyond.
          </p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LEGACY_TIPS.map((tip) => (
            <Link
              key={tip.slug}
              href={tipHref(tip)}
              className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
            >
              <InfoCallout
                icon={ICON_PATHS[tip.iconKey]}
                tone={tip.tone}
                className="relative h-full transition-colors group-hover:border-secondary/60"
              >
                <strong className="block text-primary mb-1 font-headline pr-6">
                  {tip.title}
                </strong>
                <span>{tip.body}</span>
                <Icon
                  path={ICON_PATHS.chevronRight}
                  className="absolute right-3 top-3 w-4 h-4 text-on-surface-variant/40 transition-all group-hover:text-secondary group-hover:translate-x-0.5"
                />
              </InfoCallout>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function NodeCard({
  iconPath,
  title,
  position,
  status,
  href,
  children,
}: {
  iconPath: string;
  title: string;
  position: string;
  status: "protected" | "unmapped";
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("md:absolute", position)}>
      <Link
        href={href}
        className={cn(
          "block bg-surface-container-lowest p-6 w-full md:w-64 shadow-xl hover:shadow-2xl md:hover:-translate-y-1 transition-all duration-500 cursor-pointer",
          status === "protected"
            ? "border border-secondary/10"
            : "border-2 border-error/20",
        )}
        style={{ borderRadius: "2rem" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div
            className="w-12 h-12 bg-secondary-container/30 text-secondary flex items-center justify-center"
            style={{ borderRadius: "1rem" }}
          >
            <Icon path={iconPath} className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary bg-secondary-container/20 px-2 py-1 rounded">
            Protected
          </span>
        </div>
        <h3 className="text-headline-sm text-primary mb-1">{title}</h3>
        {children}
      </Link>
    </div>
  );
}

function ContinuityScoreBadge({
  score,
  label,
}: {
  score: number;
  label: string;
}) {
  const circumference = 2 * Math.PI * 20;
  const scoreOffset = circumference - (circumference * score) / 100;
  return (
    <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-full px-6">
      <div className="relative w-12 h-12 flex items-center justify-center">
        <svg
          className="absolute inset-0 w-full h-full -rotate-90"
          viewBox="0 0 48 48"
        >
          <circle
            className="text-surface-container-high"
            cx="24"
            cy="24"
            fill="none"
            r="20"
            stroke="currentColor"
            strokeWidth="4"
          />
          <circle
            className="text-secondary transition-all duration-700"
            cx="24"
            cy="24"
            fill="none"
            r="20"
            stroke="currentColor"
            strokeDasharray={circumference}
            strokeDashoffset={scoreOffset}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
        <span className="font-headline font-bold text-primary text-body-md">
          {score}%
        </span>
      </div>
      <div>
        <p className="text-label-md text-on-surface-variant">
          Continuity Score
        </p>
        <p className="text-body-md font-bold text-primary">{label}</p>
      </div>
    </div>
  );
}
