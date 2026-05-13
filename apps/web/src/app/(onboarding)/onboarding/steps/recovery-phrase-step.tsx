"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Button, Loader } from "@keeplas/ui";
import { generatePhrase } from "@keeplas/crypto/recovery";

interface RecoveryPhraseStepProps {
  phrase: string[] | null;
  onPhraseGenerated: (words: string[]) => void;
  onContinue: () => void;
}

export function RecoveryPhraseStep({
  phrase,
  onPhraseGenerated,
  onContinue,
}: RecoveryPhraseStepProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const advanceStep = useMutation(api.onboarding.advanceOnboardingStep);

  useEffect(() => {
    if (!phrase) {
      generatePhrase().then((words: string[]) => {
        onPhraseGenerated(words);
        advanceStep({ step: "recovery_phrase" });
      });
    }
  }, [phrase, onPhraseGenerated, advanceStep]);

  async function handleCopyAll() {
    if (!phrase) return;
    await navigator.clipboard.writeText(phrase.join(" "));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload() {
    if (!phrase || exporting) return;
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const marginX = 20;
      let cursorY = 24;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text("Keeplas — Master Recovery Words", marginX, cursorY);

      cursorY += 10;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(90);
      const warning =
        "These 24 words are the only way to recover your vault. Keep this document offline and in a secure, fireproof location. Anyone with these words has full authority over your digital legacy.";
      const wrapped = pdf.splitTextToSize(warning, pageWidth - marginX * 2);
      pdf.text(wrapped, marginX, cursorY);
      cursorY += wrapped.length * 5 + 8;

      pdf.setTextColor(20);
      pdf.setFontSize(12);
      const colCount = 2;
      const colWidth = (pageWidth - marginX * 2) / colCount;
      const rowHeight = 9;
      phrase.forEach((word, index) => {
        const col = index % colCount;
        const row = Math.floor(index / colCount);
        const x = marginX + col * colWidth;
        const y = cursorY + row * rowHeight;
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(150);
        pdf.text(`${String(index + 1).padStart(2, "0")}.`, x, y);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(20);
        pdf.text(word, x + 10, y);
      });

      const gridRows = Math.ceil(phrase.length / colCount);
      cursorY += gridRows * rowHeight + 10;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(90);
      pdf.text("Copy-paste line", marginX, cursorY);
      cursorY += 5;
      pdf.setFont("courier", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(60);
      const copyPasteWrapped = pdf.splitTextToSize(
        phrase.join(" "),
        pageWidth - marginX * 2,
      );
      pdf.text(copyPasteWrapped, marginX, cursorY);

      pdf.save("keeplas-recovery-words.pdf");
    } finally {
      setExporting(false);
    }
  }

  function handleContinue() {
    onContinue();
  }

  if (!phrase) {
    return <Loader label="Generating your Recovery Words" />;
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Hero Header */}
      <section className="mb-8 md:mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-6">
        <div>
          <span className="text-label-md text-secondary mb-2 md:mb-3 block">
            Cryptographic Foundation
          </span>
          <h1 className="text-headline-lg text-primary break-words">
            Master Recovery Words
          </h1>
        </div>
        <div className="flex flex-row flex-nowrap gap-2 md:gap-3 print:hidden">
          <button
            onClick={handleCopyAll}
            className="px-5 py-3 bg-surface-container hover:bg-surface-container-high text-primary font-label font-bold text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
              />
            </svg>
            {copied ? "Copied!" : "Copy all"}
          </button>
          <button
            onClick={handleDownload}
            disabled={exporting}
            className="px-5 py-3 bg-surface-container hover:bg-surface-container-high text-primary font-label font-bold text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            {exporting ? "Generating PDF…" : "Download"}
          </button>
        </div>
      </section>

      {/* Warning Banner */}
      <div className="bg-primary-container text-on-primary-container p-5 md:p-8 rounded-2xl mb-8 md:mb-10 flex items-start gap-4 md:gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 translate-x-1/4 -translate-y-1/4">
          <svg
            className="w-48 h-48 text-on-primary-container"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v2h-2V7zm0 4h2v6h-2v-6z" />
          </svg>
        </div>
        <svg
          className="w-8 h-8 md:w-10 md:h-10 text-secondary-fixed shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
          />
        </svg>
        <div className="relative z-10">
          <h3 className="font-headline text-surface-container-lowest text-lg md:text-xl font-bold mb-2">
            Absolute Recovery Authority
          </h3>
          <p className="font-body text-on-primary-container leading-relaxed max-w-2xl">
            These words are the only way to recover your vault. Keep them
            offline and safe. Anyone with access to these words possesses full
            authority over your digital legacy. We recommend writing them on
            paper and storing in a secure, fireproof location.
          </p>
        </div>
      </div>

      {/* Recovery Words Grid */}
      <div className="bg-surface-container-low p-1 rounded-3xl mb-8 md:mb-10">
        <div className="bg-surface p-4 sm:p-6 md:p-10 rounded-[1.25rem] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 print:grid-cols-4">
          {phrase.map((word, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-surface-container-lowest rounded-xl"
            >
              <span className="font-label text-[10px] text-primary/30 font-bold w-5 text-right tabular-nums">
                {index + 1}
              </span>
              <span className="font-body text-sm font-semibold text-primary tracking-tight">
                {word}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Guidance Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10 print:hidden">
        <div className="p-6 bg-surface-container-low rounded-2xl">
          <svg
            className="w-6 h-6 text-secondary mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
            />
          </svg>
          <h4 className="font-headline font-bold text-base mb-1.5">
            Offline Storage
          </h4>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Never store these words digitally — no screenshots, cloud notes, or
            email drafts.
          </p>
        </div>
        <div className="p-6 bg-surface-container-low rounded-2xl">
          <svg
            className="w-6 h-6 text-secondary mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
            />
          </svg>
          <h4 className="font-headline font-bold text-base mb-1.5">
            Legacy Access
          </h4>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Consider sharing the location of these words with a trusted
            beneficiary.
          </p>
        </div>
        <div className="p-6 bg-surface-container-low rounded-2xl">
          <svg
            className="w-6 h-6 text-secondary mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
            />
          </svg>
          <h4 className="font-headline font-bold text-base mb-1.5">
            Verification
          </h4>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            We will ask you to verify these words to confirm your backup is
            secure.
          </p>
        </div>
      </section>

      {/* Confirmation + Continue */}
      <div className="print:hidden">
        <label className="flex items-start gap-3 mb-6 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1 w-5 h-5 rounded-lg border-2 border-outline-variant/30 text-secondary focus:ring-secondary/20 focus:ring-offset-0 accent-secondary cursor-pointer"
          />
          <span className="text-sm text-on-surface font-body">
            I have written down my 24 Recovery Words and stored them in a safe
            place. I understand that losing these words means I cannot recover
            my vault.
          </span>
        </label>

        <Button
          variant="vault"
          size="xl"
          onClick={handleContinue}
          disabled={!confirmed}
          className="w-full group cursor-pointer disabled:pointer-events-none disabled:opacity-40"
        >
          I saved my words — continue
          <svg
            className="w-5 h-5 transition-transform group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
            />
          </svg>
        </Button>
      </div>
    </div>
  );
}
