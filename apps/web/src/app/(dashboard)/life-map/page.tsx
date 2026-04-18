"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { cn, Icon, Loader } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { CATEGORIES, type VaultCategory } from "@/lib/vault-categories";

type GroupKey = "assets" | "contacts" | "directives" | "documents";

const GROUP_META: Record<
  GroupKey,
  { label: string; iconPath: string; categories: VaultCategory[]; angle: number; accent: string }
> = {
  assets: {
    label: "Assets",
    iconPath: ICON_PATHS.creditCard,
    categories: ["financial_asset", "digital_asset"],
    angle: -90,
    accent: "from-secondary/30 to-secondary/0",
  },
  contacts: {
    label: "Contacts",
    iconPath: ICON_PATHS.users,
    categories: [],
    angle: 0,
    accent: "from-tertiary/30 to-tertiary/0",
  },
  directives: {
    label: "Directives",
    iconPath: ICON_PATHS.heartbeat,
    categories: ["health_directive", "legal_document"],
    angle: 90,
    accent: "from-primary/30 to-primary/0",
  },
  documents: {
    label: "Documents",
    iconPath: ICON_PATHS.lock,
    categories: ["personal_document", "business_continuity", "credential"],
    angle: 180,
    accent: "from-error/30 to-error/0",
  },
};

export default function LifeMapPage() {
  const items = useQuery(api.vault_items.getItems);
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const lifeCheck = useQuery(api.life_check.getConfig);
  const messages = useQuery(api.conditional_messages.listMessages);

  if (items === undefined || contacts === undefined) {
    return <Loader fullscreen label="Loading Life Map" />;
  }

  const counts: Record<GroupKey, number> = {
    assets: items.filter((i) =>
      GROUP_META.assets.categories.includes(i.category as VaultCategory)
    ).length,
    contacts: contacts.length,
    directives: items.filter((i) =>
      GROUP_META.directives.categories.includes(i.category as VaultCategory)
    ).length,
    documents: items.filter((i) =>
      GROUP_META.documents.categories.includes(i.category as VaultCategory)
    ).length,
  };

  const totalCategories = CATEGORIES.length;
  const coveredCategories = new Set(items.map((i) => i.category)).size;
  const continuityScore = Math.round(
    (coveredCategories / totalCategories) * 60 +
      (contacts.length > 0 ? 20 : 0) +
      (lifeCheck?.isActive ? 20 : 0)
  );

  const missingDirectives = counts.directives === 0;
  const missingMessages = (messages?.length ?? 0) === 0;

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <h1 className="font-headline text-primary text-3xl md:text-4xl font-extrabold tracking-tight">
            Life Map
          </h1>
          <p className="text-on-surface-variant text-sm md:text-base max-w-md">
            Holistic view of your protected legacy and continuity readiness.
          </p>
        </div>
        <div className="vault-gradient text-on-primary rounded-2xl px-5 py-4 min-w-[260px]">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-80">
            Continuity Score
          </p>
          <p className="font-headline text-3xl font-extrabold mt-1">{continuityScore}%</p>
          <p className="text-xs opacity-80 mt-1">
            {continuityScore >= 75
              ? "Strong protection"
              : continuityScore >= 40
                ? "Partial coverage"
                : "Action required"}
          </p>
        </div>
      </header>

      <section className="bg-surface-container-low rounded-3xl p-8 md:p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at center, rgba(0,0,0,0.06) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative grid grid-cols-3 gap-6 items-center min-h-[520px]">
          <NodeCard
            group="assets"
            count={counts.assets}
            href="/vault?cat=financial_asset"
            position="top"
          />

          <NodeCard
            group="contacts"
            count={counts.contacts}
            href="/trusted-contacts"
            position="left"
          />

          <CenterNode score={continuityScore} />

          <NodeCard
            group="documents"
            count={counts.documents}
            href="/vault?cat=personal_document"
            position="right"
          />

          <div />
          <NodeCard
            group="directives"
            count={counts.directives}
            href="/vault?cat=health_directive"
            position="bottom"
            warning={missingDirectives}
          />
          <div />
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <article className="md:col-span-2 bg-on-surface text-surface rounded-3xl p-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-secondary-fixed font-bold">
            AI Completeness Analyzer
          </p>
          <h3 className="font-headline text-xl font-bold mt-2">
            {missingDirectives
              ? "Missing Digital Life Directive"
              : missingMessages
                ? "Add a Conditional Message"
                : "Coverage looks balanced"}
          </h3>
          <p className="text-sm opacity-80 mt-2 max-w-lg">
            {missingDirectives
              ? "Your map is missing health directives — without them, recovery agents cannot enforce medical or legal proxies."
              : missingMessages
                ? "Conditional messages let you deliver final words automatically. Add at least one for emotional continuity."
                : "Continue refreshing critical items every 90 days to keep the integrity score above 90%."}
          </p>
          <div className="flex gap-3 mt-5">
            {missingDirectives && (
              <Link
                href="/vault"
                className="inline-flex items-center gap-2 bg-secondary-fixed text-on-secondary-fixed text-sm font-medium px-4 py-2 rounded-xl hover:opacity-90"
              >
                Generate Digital Directive
              </Link>
            )}
            {missingMessages && (
              <Link
                href="/messages"
                className="inline-flex items-center gap-2 bg-secondary-fixed text-on-secondary-fixed text-sm font-medium px-4 py-2 rounded-xl hover:opacity-90"
              >
                Compose Message
              </Link>
            )}
            <Link
              href="/security"
              className="inline-flex items-center gap-2 text-secondary-fixed text-sm font-medium px-4 py-2 rounded-xl hover:bg-white/5"
            >
              View audit log
            </Link>
          </div>
        </article>

        <BentoStat
          label="Vault Sync"
          value={`${items.length} items`}
          hint="Mirrored to secure nodes"
        />
        <BentoStat
          label="Map Activity"
          value={lifeCheck?.lastCheckAt ? "Recent" : "Idle"}
          hint="Last heartbeat"
        />
        <BentoStat
          label="Key Health"
          value="Optimal"
          hint="Backup shards stored"
        />
        <BentoStat
          label="Trustee Access"
          value={`${contacts.filter((c) => c.invitationStatus === "accepted").length} of ${contacts.length}`}
          hint="Onboarded guardians"
        />
      </section>
    </div>
  );
}

function NodeCard({
  group,
  count,
  href,
  position,
  warning,
}: {
  group: GroupKey;
  count: number;
  href: string;
  position: "top" | "left" | "right" | "bottom";
  warning?: boolean;
}) {
  const meta = GROUP_META[group];
  const justify =
    position === "left"
      ? "justify-self-start"
      : position === "right"
        ? "justify-self-end"
        : "justify-self-center";

  return (
    <Link
      href={href}
      className={cn(
        "relative rounded-3xl p-5 w-full max-w-[220px] bg-surface-container hover:scale-[1.02] transition-all",
        justify,
        warning && "ring-2 ring-error/40"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 rounded-3xl bg-gradient-to-br opacity-60",
          meta.accent
        )}
      />
      <div className="relative space-y-3">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-surface text-on-surface">
          <Icon path={meta.iconPath} className="w-5 h-5" />
        </span>
        <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-bold">
          {meta.label}
        </p>
        <p className="font-headline text-2xl font-extrabold text-on-surface">{count}</p>
        {warning && (
          <span className="inline-block text-[9px] uppercase tracking-[0.2em] font-bold bg-error text-on-error px-2 py-0.5 rounded-full animate-pulse">
            Action Required
          </span>
        )}
      </div>
    </Link>
  );
}

function CenterNode({ score }: { score: number }) {
  return (
    <div className="justify-self-center">
      <div className="relative w-44 h-44 rounded-full vault-gradient flex flex-col items-center justify-center text-on-primary shadow-2xl shadow-primary/30">
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-80">
          Your Legacy
        </span>
        <span className="font-headline text-4xl font-extrabold mt-1">{score}%</span>
        <span className="text-[10px] mt-1 opacity-80">protected</span>
      </div>
    </div>
  );
}

function BentoStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-bold">
        {label}
      </p>
      <p className="font-headline text-lg font-bold text-on-surface mt-1">{value}</p>
      <p className="text-xs text-on-surface-variant mt-1">{hint}</p>
    </div>
  );
}
