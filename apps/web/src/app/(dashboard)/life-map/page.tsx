"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { cn, Icon, Loader, UserAvatar } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { CATEGORIES, type VaultCategory } from "@/lib/vault-categories";
import { getInitials } from "@/lib/user";
import { formatTimeAgo } from "@/lib/format";

const ASSET_CATEGORIES: VaultCategory[] = ["financial_asset", "digital_asset"];
const DIRECTIVE_CATEGORIES: VaultCategory[] = ["health_directive", "legal_document"];
const DOCUMENT_CATEGORIES: VaultCategory[] = [
  "personal_document",
  "business_continuity",
  "credential",
];

export default function LifeMapPage() {
  const items = useQuery(api.vault_items.getItems);
  const contacts = useQuery(api.trusted_contacts.getContacts);
  const lifeCheck = useQuery(api.life_check.getConfig);
  const messages = useQuery(api.conditional_messages.listMessages);

  if (items === undefined || contacts === undefined) {
    return <Loader fullscreen label="Loading Life Map" />;
  }

  const assets = items.filter((i) =>
    ASSET_CATEGORIES.includes(i.category as VaultCategory)
  );
  const directives = items.filter((i) =>
    DIRECTIVE_CATEGORIES.includes(i.category as VaultCategory)
  );
  const documents = items.filter((i) =>
    DOCUMENT_CATEGORIES.includes(i.category as VaultCategory)
  );

  const totalCategories = CATEGORIES.length;
  const coveredCategories = new Set(items.map((i) => i.category)).size;
  const continuityScore = Math.round(
    (coveredCategories / totalCategories) * 60 +
      (contacts.length > 0 ? 20 : 0) +
      (lifeCheck?.isActive ? 20 : 0)
  );
  const scoreLabel =
    continuityScore >= 75
      ? "Strong Protection"
      : continuityScore >= 40
        ? "Partial Coverage"
        : "Action Required";

  const missingDirectives = directives.length === 0;
  const missingMessages = (messages?.length ?? 0) === 0;
  const aiPercentage = Math.min(continuityScore + (messages && messages.length > 0 ? 5 : 0), 99);

  const verifiedTrustees = contacts.filter((c) => c.invitationStatus === "accepted").length;
  const circumference = 2 * Math.PI * 20;
  const scoreOffset = circumference - (circumference * continuityScore) / 100;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-headline text-5xl font-extrabold text-primary tracking-tighter mb-2 leading-none">
            Life Map
          </h1>
          <p className="text-secondary font-medium tracking-wide max-w-lg">
            A holistic visual overview of your protected legacy and continuity readiness.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-full px-6">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
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
            <span className="font-headline font-bold text-primary text-xs">
              {continuityScore}%
            </span>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
              Continuity Score
            </p>
            <p className="text-sm font-bold text-primary">{scoreLabel}</p>
          </div>
        </div>
      </header>

      {/* Life Map Canvas */}
      <div
        className="relative min-h-[700px] bg-surface-container-low rounded-[2rem] overflow-hidden p-8 mb-12"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(40, 101, 122, 0.25) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {/* Center Node */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <div
            className="w-48 h-48 bg-primary flex flex-col items-center justify-center text-white shadow-2xl p-6 text-center border-8 border-surface-container-low"
            style={{ borderRadius: "50%" }}
          >
            <Icon path={ICON_PATHS.fingerprint} className="w-10 h-10 mb-2" />
            <p className="font-headline font-extrabold text-lg leading-tight uppercase tracking-tighter">
              Your Legacy
            </p>
            <p className="text-[10px] text-secondary-fixed font-medium mt-1 uppercase tracking-widest">
              Central Node
            </p>
          </div>
        </div>

        {/* Assets — top left */}
        <NodeCard
          iconPath={ICON_PATHS.accountBalance}
          title="Assets"
          position="top-10 left-10 md:left-24"
          status="protected"
        >
          <div className="space-y-3 mt-4">
            <AssetLine label="Real Estate Portfolio" present={assets.some((a) => a.title.toLowerCase().includes("real") || a.category === "financial_asset")} />
            <AssetLine label="Retirement Accounts" present={assets.some((a) => a.category === "financial_asset")} />
            <AssetLine label="Digital Wallets" present={assets.some((a) => a.category === "digital_asset")} />
          </div>
        </NodeCard>

        {/* Contacts — bottom left */}
        <NodeCard
          iconPath={ICON_PATHS.group}
          title="Contacts"
          position="bottom-10 left-10 md:left-24"
          status="protected"
        >
          {contacts.length === 0 ? (
            <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
              No guardians linked yet.
            </p>
          ) : (
            <>
              <div className="flex -space-x-3 mt-4 mb-3">
                {contacts.slice(0, 3).map((c) => (
                  <div
                    key={c._id}
                    className="w-10 h-10 border-2 border-surface shadow-sm overflow-hidden"
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
                {contacts.length > 3 && (
                  <div
                    className="w-10 h-10 border-2 border-surface bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-on-surface-variant"
                    style={{ borderRadius: "50%" }}
                  >
                    +{contacts.length - 3}
                  </div>
                )}
              </div>
              <p className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest">
                {contacts.length} Primary Guardian{contacts.length > 1 ? "s" : ""} Linked
              </p>
            </>
          )}
        </NodeCard>

        {/* Directives — top right */}
        <div className="absolute top-10 right-10 md:right-24">
          <div
            className={cn(
              "p-6 w-64 relative shadow-xl hover:shadow-2xl transition-all duration-500",
              missingDirectives
                ? "bg-surface-container border-2 border-error/20"
                : "bg-surface-container-lowest border border-secondary/10"
            )}
            style={{ borderRadius: "2rem" }}
          >
            {missingDirectives && (
              <div className="absolute -top-3 -right-3 bg-error text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter animate-pulse">
                Action Required
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <div
                className={cn(
                  "w-12 h-12 flex items-center justify-center",
                  missingDirectives
                    ? "bg-error/10 text-error"
                    : "bg-secondary-container/30 text-secondary"
                )}
                style={{ borderRadius: "1rem" }}
              >
                <Icon path={ICON_PATHS.medicalInformation} className="w-6 h-6" />
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded",
                  missingDirectives
                    ? "text-error bg-error/10"
                    : "text-secondary bg-secondary-container/20"
                )}
              >
                {missingDirectives ? "Unmapped" : "Protected"}
              </span>
            </div>
            <h3 className="font-headline font-bold text-primary mb-1">Directives</h3>
            {missingDirectives ? (
              <>
                <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                  Medical POA and Advance Directives are currently missing or expired.
                </p>
                <Link
                  href="/vault"
                  className="mt-4 w-full py-2 bg-error text-white rounded-lg text-xs font-bold font-headline transition-transform active:scale-95 flex items-center justify-center"
                >
                  Update Now
                </Link>
              </>
            ) : (
              <div className="space-y-3 mt-4">
                {directives.slice(0, 3).map((d) => (
                  <div key={d._id} className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant truncate">{d.title}</span>
                    <Icon
                      path={ICON_PATHS.checkCircle}
                      className="w-3.5 h-3.5 text-secondary shrink-0 ml-2"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Documents — bottom right */}
        <div className="absolute bottom-10 right-10 md:right-24">
          <div
            className="bg-surface-container-lowest p-6 w-64 shadow-xl hover:shadow-2xl transition-all duration-500 border border-secondary/10"
            style={{ borderRadius: "2rem" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className="w-12 h-12 bg-secondary-container/30 text-secondary flex items-center justify-center"
                style={{ borderRadius: "1rem" }}
              >
                <Icon path={ICON_PATHS.description} className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary bg-secondary-container/20 px-2 py-1 rounded">
                {documents.length > 0 ? "Protected" : "Empty"}
              </span>
            </div>
            <h3 className="font-headline font-bold text-primary mb-1">Documents</h3>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <DocThumbnail icon={ICON_PATHS.home} label="Deeds" />
              <DocThumbnail icon={ICON_PATHS.historyEdu} label="Will" />
            </div>
          </div>
        </div>

        {/* Decorative connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
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

      {/* AI Completeness Analyzer */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div
          className="md:col-span-2 bg-primary-container text-white p-8 shadow-2xl relative overflow-hidden"
          style={{ borderRadius: "2rem" }}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <Icon
                path={ICON_PATHS.psychology}
                className="w-8 h-8 text-secondary-fixed"
              />
              <h2 className="font-headline text-2xl font-bold tracking-tight">
                AI Completeness Analyzer
              </h2>
            </div>
            <p className="text-on-primary-container max-w-lg mb-8 text-lg leading-relaxed italic">
              &ldquo;You have secured {aiPercentage}% of your vital legacy.{" "}
              {missingDirectives
                ? "The missing link is your Digital Life Directive, which prevents executors from accessing your encrypted assets."
                : missingMessages
                  ? "Add at least one Conditional Message so your final words reach the people who matter."
                  : "Keep refreshing critical documents every 90 days to maintain continuity above 90%."}
              &rdquo;
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href={missingDirectives ? "/vault" : "/messages"}
                className="bg-secondary-fixed text-on-secondary-fixed font-headline font-extrabold px-6 py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-black/20"
              >
                {missingDirectives
                  ? "Generate Digital Directive"
                  : missingMessages
                    ? "Compose Message"
                    : "Review Vault"}
              </Link>
              <Link
                href="/settings/security"
                className="text-white border border-white/20 hover:bg-white/10 px-6 py-3 rounded-xl transition-all font-headline font-bold"
              >
                Review Risks
              </Link>
            </div>
          </div>
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-secondary/10 blur-[100px] pointer-events-none" style={{ borderRadius: "50%" }} />
        </div>

        <div
          className="bg-surface-container-low p-8 flex flex-col justify-center"
          style={{ borderRadius: "2rem" }}
        >
          <h3 className="font-headline font-bold text-primary mb-4 text-xl">
            Protected Zones
          </h3>
          <ul className="space-y-4">
            <ZoneLine label="Financial Redundancy" safe={assets.length > 0} />
            <ZoneLine label="Trusted Node Mesh" safe={contacts.length > 0} />
            <ZoneLine label="Real Estate Chain" safe={assets.length > 1} />
            <ZoneLine
              label={missingDirectives ? "Healthcare Directive Gap" : "Healthcare Directives"}
              safe={!missingDirectives}
            />
          </ul>
        </div>
      </section>

      {/* Secondary Bento */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <BentoItem
          iconPath={ICON_PATHS.history}
          title="Map Activity"
          hint={
            lifeCheck?.lastCheckAt
              ? `Last verified ${formatTimeAgo(lifeCheck.lastCheckAt)}.`
              : "No recent verification yet."
          }
        />
        <BentoItem
          iconPath={ICON_PATHS.cloudSync}
          title="Vault Sync"
          hint={`${items.length} item${items.length === 1 ? "" : "s"} mirrored to secure nodes.`}
        />
        <BentoItem
          iconPath={ICON_PATHS.lockReset}
          title="Key Health"
          hint="Physical keys and backup shards are in optimal storage locations."
        />
        <BentoItem
          iconPath={ICON_PATHS.shareReviews}
          title="Trustee Access"
          hint={`${verifiedTrustees} of ${contacts.length || 5} Trustees completed life-drill onboarding.`}
        />
      </section>
    </div>
  );
}

function NodeCard({
  iconPath,
  title,
  position,
  status,
  children,
}: {
  iconPath: string;
  title: string;
  position: string;
  status: "protected" | "unmapped";
  children: React.ReactNode;
}) {
  return (
    <div className={cn("absolute", position)}>
      <div
        className={cn(
          "bg-surface-container-lowest p-6 w-64 shadow-xl hover:shadow-2xl transition-all duration-500",
          status === "protected"
            ? "border border-secondary/10"
            : "border-2 border-error/20"
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
        <h3 className="font-headline font-bold text-primary mb-1">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function AssetLine({ label, present }: { label: string; present: boolean }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-on-surface-variant">{label}</span>
      <Icon
        path={ICON_PATHS.checkCircle}
        className={cn(
          "w-3.5 h-3.5",
          present ? "text-secondary" : "text-outline-variant/40"
        )}
      />
    </div>
  );
}

function DocThumbnail({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="bg-surface-container p-2 rounded-lg flex flex-col items-center justify-center aspect-square text-center">
      <Icon path={icon} className="w-5 h-5 text-on-surface-variant" />
      <span className="text-[8px] font-bold mt-1 uppercase text-on-surface-variant">
        {label}
      </span>
    </div>
  );
}

function ZoneLine({ label, safe }: { label: string; safe: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={cn("w-2 h-2", safe ? "bg-secondary" : "bg-error animate-pulse")}
        style={{ borderRadius: "50%" }}
      />
      <span
        className={cn(
          "text-sm",
          safe ? "font-medium text-on-surface" : "font-bold text-error"
        )}
      >
        {label}
      </span>
    </li>
  );
}

function BentoItem({
  iconPath,
  title,
  hint,
}: {
  iconPath: string;
  title: string;
  hint: string;
}) {
  return (
    <div
      className="bg-surface-container-lowest p-6 shadow-sm flex flex-col justify-between"
      style={{ borderRadius: "1.5rem" }}
    >
      <div>
        <Icon path={iconPath} className="w-6 h-6 text-secondary-fixed-dim mb-3" />
        <h4 className="font-headline font-bold text-primary">{title}</h4>
      </div>
      <p className="text-xs text-on-surface-variant mt-4">{hint}</p>
    </div>
  );
}
