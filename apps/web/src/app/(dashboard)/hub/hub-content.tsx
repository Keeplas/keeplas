"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  buttonVariants,
  cn,
  HelpHint,
  Icon,
  InfoCallout,
  Loader,
  UserAvatar,
} from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";
import { ICON_PATHS } from "@/lib/icons";
import { ReturnAfterReleaseBanner } from "@/components/return-after-release-banner";
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
  distribute_shards: ICON_PATHS.shieldCheck,
  life_check: ICON_PATHS.heartbeat,
  release_policy: ICON_PATHS.group,
  welcome_message: ICON_PATHS.mail,
  two_factor: ICON_PATHS.key,
  verify_whatsapp: ICON_PATHS.phone,
  more_categories: ICON_PATHS.plus,
};

// Plain-language explanation surfaced via the per-action help icon, so users
// understand why each step matters before they commit to it. The text is
// resolved via t("hints.<key>") inside the component; this set gates which
// actions show a help icon at all.
const ACTION_HINT_KEYS = new Set<string>([
  "add_item",
  "invite_contact",
  "distribute_shards",
  "life_check",
  "release_policy",
  "welcome_message",
  "two_factor",
  "verify_whatsapp",
  "more_categories",
]);

export function HubContent() {
  const t = useTranslations("hub");
  const items = useQuery(api.vault_items.getItems);
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const hubData = useQuery(api.hub.getHubData);

  if (items === undefined || contacts === undefined || hubData === undefined) {
    return <Loader fullscreen label={t("loading")} />;
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
      ? t("score.strong")
      : continuityScore >= 40
        ? t("score.partial")
        : t("score.actionRequired");

  return (
    <div className="max-w-screen-2xl mx-auto">
      {/* Header */}
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-headline-lg text-primary mb-2">{t("title")}</h1>
          <p className="text-body-lg text-secondary max-w-lg text-balance">
            {t("subtitle.line1")}
            <br />
            {t("subtitle.line2")}
          </p>
        </div>

        <a
          href="#priority-actions"
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          aria-label={t("jumpToPriorityActions")}
        >
          <ContinuityScoreBadge
            score={continuityScore}
            label={scoreLabel}
            actionsLabel={t("actionsRequired")}
          />
        </a>
      </header>

      <ReturnAfterReleaseBanner />

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
              {t("centerNode.title")}
            </p>
            <p className="text-label-md text-secondary-fixed mt-1">
              {t("centerNode.subtitle")}
            </p>
          </div>
        </div>

        {/* Assets — top left */}
        <NodeCard
          iconPath={ICON_PATHS.accountBalance}
          title={t("nodes.assets.title")}
          emptyLabel={t("nodes.empty")}
          protectedLabel={t("nodes.protected")}
          position="md:top-10 md:left-10 lg:left-24"
          isEmpty={assets.length === 0}
          href="/vault"
        >
          {assets.length === 0 ? (
            <p className="text-body-md text-on-surface-variant mt-2">
              {t("nodes.assets.empty")}
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
          title={t("nodes.contacts.title")}
          emptyLabel={t("nodes.empty")}
          protectedLabel={t("nodes.protected")}
          position="md:bottom-10 md:left-10 lg:left-24"
          isEmpty={contacts.length === 0}
          href="/trusted-contacts"
        >
          {contacts.length === 0 ? (
            <p className="text-body-md text-on-surface-variant mt-2">
              {t("nodes.contacts.empty")}
            </p>
          ) : (
            <>
              <div className="flex -space-x-2 mt-4 mb-3">
                {contacts.slice(0, 3).map((c) => (
                  <UserAvatar
                    key={c._id}
                    size="md"
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
                {contacts.length > 1
                  ? t("nodes.contacts.guardiansLinked", {
                      count: contacts.length,
                    })
                  : t("nodes.contacts.guardianLinked", {
                      count: contacts.length,
                    })}
              </p>
            </>
          )}
        </NodeCard>

        {/* Directives — top right */}
        <NodeCard
          iconPath={ICON_PATHS.medicalInformation}
          title={t("nodes.directives.title")}
          emptyLabel={t("nodes.empty")}
          protectedLabel={t("nodes.protected")}
          position="md:top-10 md:right-10 lg:right-24"
          isEmpty={directives.length === 0}
          href="/vault?section=documents"
        >
          {directives.length === 0 ? (
            <p className="text-body-md text-on-surface-variant mt-2">
              {t("nodes.directives.empty")}
            </p>
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
        </NodeCard>

        {/* Documents — bottom right */}
        <NodeCard
          iconPath={ICON_PATHS.description}
          title={t("nodes.documents.title")}
          emptyLabel={t("nodes.empty")}
          protectedLabel={t("nodes.protected")}
          position="md:bottom-10 md:right-10 lg:right-24"
          isEmpty={documents.length === 0}
          href="/vault?section=documents"
        >
          {documents.length === 0 ? (
            <p className="text-body-md text-on-surface-variant mt-2">
              {t("nodes.documents.empty")}
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
        </NodeCard>

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
            stroke="#041632"
            strokeDasharray="8 8"
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
            {t("priorityActions")}
          </h4>
          <div className="space-y-2">
            {hubData.priorityActions.map((action) => (
              // Container (not the Link) carries the background and `group` so
              // the help button can sit beside the Link — a <button> nested in
              // an <a> is invalid HTML.
              <div
                key={action.key}
                className={cn(
                  "flex items-center transition-colors rounded-xl group",
                  action.done
                    ? "bg-surface-container-low/50 hover:bg-surface-container-low"
                    : "bg-error/10 hover:bg-error/15",
                )}
              >
                <Link
                  href={action.href}
                  className="flex flex-1 min-w-0 items-center gap-3 p-4 cursor-pointer"
                >
                  <span
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center shadow-sm shrink-0",
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
                  <span
                    className={cn(
                      "font-headline font-bold text-sm truncate",
                      action.done
                        ? "text-on-surface-variant line-through decoration-on-surface-variant/40"
                        : "text-error",
                    )}
                  >
                    {action.label}
                  </span>
                </Link>
                <div className="flex items-center gap-1 pr-3 shrink-0">
                  {ACTION_HINT_KEYS.has(action.key) && (
                    <HelpHint content={t(`hints.${action.key}`)} side="left" />
                  )}
                  <Icon
                    path={ICON_PATHS.chevronRight}
                    className={cn(
                      "w-5 h-5 transition-transform",
                      action.done
                        ? "text-outline-variant/40"
                        : "text-outline-variant group-hover:translate-x-1",
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-label-md text-on-surface-variant">
              {t("recentActivity.title")}
            </h4>
            {hubData.totalItems > 0 && (
              <Link
                href="/vault"
                className="text-xs text-secondary font-bold cursor-pointer hover:underline"
              >
                {t("recentActivity.viewAll")}
              </Link>
            )}
          </div>
          {hubData.recentItems.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-on-surface-variant mb-4">
                {t("recentActivity.empty")}
              </p>
              <Link
                href="/vault"
                className={buttonVariants({ variant: "vault", size: "sm" })}
              >
                {t("recentActivity.addFirst")}
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
            {t("reflect.title")}
          </h4>
          <p className="text-body-md text-on-surface-variant/80 mt-1">
            {t("reflect.subtitle")}
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
  emptyLabel,
  protectedLabel,
  position,
  isEmpty,
  href,
  children,
}: {
  iconPath: string;
  title: string;
  emptyLabel: string;
  protectedLabel: string;
  position: string;
  isEmpty: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("md:absolute", position)}>
      <Link
        href={href}
        className="block bg-surface-container-lowest p-6 w-full md:w-64 shadow-xl hover:shadow-2xl md:hover:-translate-y-1 transition-all duration-500 border border-secondary/10 cursor-pointer"
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
            {isEmpty ? emptyLabel : protectedLabel}
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
  actionsLabel,
}: {
  score: number;
  label: string;
  actionsLabel: string;
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
            className="text-error transition-all duration-700"
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
          {actionsLabel}
        </p>
        <p className="text-body-md font-bold text-error">{label}</p>
      </div>
    </div>
  );
}
