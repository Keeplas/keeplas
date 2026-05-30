"use client";

import { useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Button, cn, ErrorAlert, Icon, Loader, Textarea } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { parseRecoveryPhrase } from "@/lib/parse-recovery-phrase";
import { QRCodeSVG } from "@/components/qr-code-svg";
import { useTranslations } from "@/lib/i18n";

const GRAIN_DATA_URL =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")";

function buildDocumentId(
  creationTime: number | undefined,
  userId: string | undefined,
) {
  const date = new Date(creationTime ?? 0);
  const yyyy = date.getUTCFullYear().toString().padStart(4, "0");
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = date.getUTCDate().toString().padStart(2, "0");
  const suffix = (userId ?? "00000000").slice(-4).toUpperCase();
  const tail = (creationTime ?? 0).toString(36).slice(-2).toUpperCase();
  return `KP-REC-${yyyy}-${mm}${dd}-${suffix}-${tail}`;
}

function formatKitTimestamp(ts: number | undefined) {
  if (!ts) return "—";
  const date = new Date(ts);
  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
  const timePart = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  });
  return `${datePart} at ${timePart} UTC`;
}

const PLACEHOLDER_WORDS = Array.from({ length: 12 }, () => "••••••");

export default function RecoveryKitPage() {
  const t = useTranslations("settingsSecurity");
  const user = useQuery(api.users.viewer);
  const [words, setWords] = useState<string[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const printableRef = useRef<HTMLElement>(null);

  if (user === undefined)
    return <Loader fullscreen label={t("recoveryKit.loading")} />;

  const revealed = words !== null;
  const displayedWords = words ?? PLACEHOLDER_WORDS;

  const documentId = buildDocumentId(
    user?._creationTime,
    user?._id ?? undefined,
  );
  const generatedAt = formatKitTimestamp(user?._creationTime);
  const accountId = user?.email ?? user?.phoneNumber ?? null;
  const accountSlug =
    (accountId ?? "account")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "account";

  async function handleExportPdf() {
    if (!printableRef.current || exporting) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);
      const node = printableRef.current;
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
      let renderWidth = pageWidth;
      let renderHeight = renderWidth / ratio;
      if (renderHeight > pageHeight) {
        renderHeight = pageHeight;
        renderWidth = renderHeight * ratio;
      }
      const offsetX = (pageWidth - renderWidth) / 2;
      const offsetY = (pageHeight - renderHeight) / 2;
      pdf.addImage(imgData, "PNG", offsetX, offsetY, renderWidth, renderHeight);
      pdf.save(`${documentId}-${accountSlug}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="max-w-screen-2xl mx-auto flex flex-col gap-10">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 print:hidden">
        <div className="max-w-2xl space-y-4">
          <h1 className="text-headline-lg text-primary">
            {t("recoveryKit.title")}
          </h1>
          <p className="text-body-lg text-on-surface-variant">
            {t("recoveryKit.intro")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {revealed && (
            <button
              onClick={() => setWords(null)}
              className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-surface-container-high text-primary ghost-border rounded-xl transition-all font-semibold cursor-pointer"
            >
              <Icon path={ICON_PATHS.lock} className="w-5 h-5" />
              {t("recoveryKit.relock")}
            </button>
          )}
          <button
            onClick={() => window.print()}
            disabled={!revealed}
            className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-surface-container-high text-primary ghost-border rounded-xl transition-all font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icon path={ICON_PATHS.print} className="w-5 h-5" />
            {t("recoveryKit.printSecureCopy")}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={!revealed || exporting}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white hover:opacity-90 rounded-xl transition-all font-semibold shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icon
              path={exporting ? ICON_PATHS.refresh : ICON_PATHS.download}
              className={cn("w-5 h-5", exporting && "animate-spin")}
            />
            {exporting
              ? t("recoveryKit.generatingPdf")
              : t("recoveryKit.downloadPdf")}
          </button>
        </div>
      </div>

      {/* Document */}
      <article
        ref={printableRef}
        id="recovery-kit-printable"
        className="relative bg-surface-container-lowest overflow-hidden shadow-2xl rounded-2xl flex flex-col md:flex-row min-h-[800px] print:shadow-none print:rounded-none"
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: GRAIN_DATA_URL, opacity: 0.03 }}
        />

        {/* Left — Branding & Logic */}
        <aside className="w-full md:w-1/3 bg-primary text-on-primary-container p-10 md:p-12 flex flex-col justify-between relative">
          <div className="space-y-12 relative z-10">
            <div className="space-y-1">
              <div className="text-headline-md text-white">Keeplas</div>
              <div className="text-label-md opacity-70">
                {t("recoveryKit.architecturalVault")}
              </div>
            </div>

            <div className="space-y-6">
              <FeatureCard
                icon={ICON_PATHS.verifiedUser}
                title={t("recoveryKit.identityTitle")}
                description={t("recoveryKit.identityDescription")}
              />
              <FeatureCard
                icon={ICON_PATHS.security}
                title={t("recoveryKit.coldStorageTitle")}
                description={t("recoveryKit.coldStorageDescription")}
              />
            </div>
          </div>

          <div className="mt-12 pt-12 border-t border-white/10 relative z-10 space-y-4">
            <div>
              <div className="text-label-md opacity-40 mb-2">
                {t("recoveryKit.documentId")}
              </div>
              <div className="font-mono text-body-md opacity-60">
                {documentId}
              </div>
            </div>
            <div>
              <div className="text-label-md opacity-40 mb-2">
                {t("recoveryKit.account")}
              </div>
              <div className="font-mono text-body-md opacity-60 break-all">
                {accountId ?? "—"}
              </div>
            </div>
          </div>
        </aside>

        {/* Right — Recovery data */}
        <section className="w-full md:w-2/3 p-10 md:p-12 bg-white flex flex-col gap-12">
          {/* Step 01 — QR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            <div className="space-y-5">
              <StepBadge label={t("recoveryKit.step01")} />
              <h2 className="text-headline-md text-primary">
                {t("recoveryKit.qrTitle")}
              </h2>
              <p className="text-body-md text-on-surface-variant">
                {t("recoveryKit.qrDescription")}
              </p>
              <div className="flex flex-col gap-3 pt-2">
                <CheckItem label={t("recoveryKit.checkE2e")} />
                <CheckItem label={t("recoveryKit.checkSingleUse")} />
              </div>
            </div>

            <QRPanel words={words} t={t} />
          </div>

          {/* Step 02 — Seed Phrase */}
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <StepBadge label={t("recoveryKit.step02")} />
                <h2 className="text-headline-md text-primary">
                  {t("recoveryKit.seedTitle")}
                </h2>
              </div>
              <Icon
                path={revealed ? ICON_PATHS.lockOpen : ICON_PATHS.lock}
                className={cn(
                  "w-10 h-10 text-on-surface-variant",
                  revealed ? "opacity-30" : "opacity-60",
                )}
              />
            </div>

            {revealed ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {displayedWords.map((word, idx) => (
                  <PhraseBlock
                    key={idx}
                    index={idx + 1}
                    word={word}
                    masked={false}
                  />
                ))}
              </div>
            ) : (
              <PhraseUnlockForm onReveal={setWords} t={t} />
            )}
          </div>

          {/* Bottom — Legal & Validation */}
          <div className="mt-auto grid grid-cols-1 md:grid-cols-2 gap-8 pt-10 border-t border-surface-container">
            <BottomInfoCard
              icon={ICON_PATHS.warning}
              title={t("recoveryKit.finalWarningTitle")}
              description={t("recoveryKit.finalWarningDescription")}
            />
            <BottomInfoCard
              icon={ICON_PATHS.historyEdu}
              title={t("recoveryKit.userValidationTitle")}
              description={t("recoveryKit.generatedOn", { date: generatedAt })}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-3.5 h-3.5",
                    user?.recoveryVerified
                      ? "bg-secondary-fixed"
                      : "bg-outline-variant",
                  )}
                  style={{ borderRadius: "50%" }}
                />
                <span className="text-label-md font-mono">
                  SECURE_AUTH_STATUS:{" "}
                  {user?.recoveryVerified ? "VALIDATED" : "PENDING"}
                </span>
              </div>
            </BottomInfoCard>
          </div>
        </section>
      </article>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function QRPanel({
  words,
  t,
}: {
  words: string[] | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-surface-container-low rounded-2xl relative aspect-square">
      <div className="w-full h-full flex items-center justify-center">
        {words ? (
          <QRCodeSVG value={words.join(" ")} size={240} />
        ) : (
          <div className="flex flex-col items-center justify-center text-on-surface-variant gap-3">
            <Icon path={ICON_PATHS.lock} className="w-12 h-12 opacity-30" />
            <span className="text-label-md opacity-60">
              {t("recoveryKit.qrSealed")}
            </span>
          </div>
        )}
      </div>
      <div className="absolute -bottom-3 bg-white px-4 py-1 shadow-sm ghost-border rounded-full text-label-md text-on-surface-variant">
        {t("recoveryKit.secureScanPoint")}
      </div>
    </div>
  );
}

function PhraseUnlockForm({
  onReveal,
  t,
}: {
  onReveal: (words: string[]) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseRecoveryPhrase(input);
    if (parsed.length !== 12 && parsed.length !== 24) {
      setError(t("recoveryKit.phraseLengthError"));
      return;
    }
    setError("");
    onReveal(parsed);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {PLACEHOLDER_WORDS.map((word, idx) => (
          <PhraseBlock key={idx} index={idx + 1} word={word} masked />
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-surface-container-low rounded-xl p-6 space-y-4"
      >
        <div className="space-y-2">
          <p className="text-label-md text-on-surface-variant">
            {t("recoveryKit.unlockReveal")}
          </p>
          <p className="text-body-md text-on-surface-variant">
            {t("recoveryKit.unlockDescription")}
          </p>
        </div>

        <ErrorAlert message={error} />

        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="word1 word2 word3 ..."
          autoComplete="off"
          spellCheck={false}
        />

        <p className="text-label-md text-on-surface-variant">
          {t("recoveryKit.pasteHint")}
        </p>

        <Button type="submit" variant="vault" size="md" className="w-full">
          {t("recoveryKit.revealCta")}
        </Button>
      </form>
    </div>
  );
}

function StepBadge({ label }: { label: string }) {
  return (
    <span className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container text-label-md rounded">
      {label}
    </span>
  );
}

function CheckItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-body-md text-primary font-semibold">
      <Icon path={ICON_PATHS.checkCircle} className="w-4 h-4 text-secondary" />
      <span>{label}</span>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-white/5 rounded-xl space-y-3">
      <Icon path={icon} className="w-7 h-7 text-secondary-fixed" />
      <h3 className="text-headline-sm text-white">{title}</h3>
      <p className="text-body-md opacity-80">{description}</p>
    </div>
  );
}

function PhraseBlock({
  index,
  word,
  masked,
}: {
  index: number;
  word: string;
  masked: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-surface-container-low p-4 rounded-xl flex items-center gap-4 group transition-all duration-300",
        masked ? "opacity-60" : "hover:bg-primary",
      )}
    >
      <span
        className={cn(
          "text-label-md",
          masked
            ? "text-on-surface-variant/40"
            : "text-on-surface-variant/50 group-hover:text-white/50",
        )}
      >
        {String(index).padStart(2, "0")}
      </span>
      <span
        className={cn(
          "font-mono text-body-md font-bold uppercase tracking-wider truncate",
          masked
            ? "text-outline-variant"
            : "text-primary group-hover:text-white",
        )}
      >
        {word}
      </span>
    </div>
  );
}

function BottomInfoCard({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <div
        className="w-12 h-12 bg-surface-container flex items-center justify-center shrink-0"
        style={{ borderRadius: "50%" }}
      >
        <Icon path={icon} className="w-5 h-5 text-primary" />
      </div>
      <div className="space-y-1">
        <div className="text-label-md text-on-surface">{title}</div>
        {children}
        <p className="text-body-md text-on-surface-variant">{description}</p>
      </div>
    </div>
  );
}
