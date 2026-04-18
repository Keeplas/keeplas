"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  Button,
  cn,
  ErrorAlert,
  Icon,
  Label,
  Loader,
  Textarea,
} from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { QRCodeSVG } from "../emergency-card/qr-code-svg";

function maskWord(word: string, reveal: boolean) {
  if (reveal) return word;
  return "•".repeat(Math.max(4, word.length));
}

export default function RecoveryKitPage() {
  const user = useQuery(api.users.viewer);
  const [phraseInput, setPhraseInput] = useState("");
  const [verified, setVerified] = useState<string[] | null>(null);
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");

  if (user === undefined) return <Loader fullscreen label="Loading recovery kit" />;

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const words = phraseInput.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length !== 12 && words.length !== 24) {
      setError("Recovery phrase must be 12 or 24 words.");
      return;
    }
    setError("");
    setVerified(words);
  }

  function handlePrint() {
    window.print();
  }

  if (!verified) {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="space-y-2">
          <span className="inline-block bg-secondary px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold text-on-secondary">
            Master Recovery Key
          </span>
          <h1 className="font-headline text-primary text-3xl md:text-4xl font-extrabold tracking-tight">
            Export your Recovery Kit
          </h1>
          <p className="text-on-surface-variant text-sm md:text-base max-w-xl">
            Re-enter your recovery phrase to render a printable kit and a scannable QR. Your
            phrase never leaves this device — Keeplas only knows the hash.
          </p>
        </header>

        <div className="bg-surface-container-low rounded-3xl p-6 space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-tertiary">
            Identity Verification
          </p>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-on-surface-variant">Account</dt>
            <dd className="text-on-surface font-medium">{user?.email ?? "—"}</dd>
            <dt className="text-on-surface-variant">Phrase verified</dt>
            <dd className="text-on-surface font-medium">
              {user?.recoveryVerified ? "Yes" : "Not yet"}
            </dd>
            <dt className="text-on-surface-variant">Phrase hash</dt>
            <dd className="text-on-surface font-mono text-xs truncate">
              {user?.recoveryPhraseHash?.slice(0, 16) ?? "—"}…
            </dd>
          </dl>
        </div>

        <form
          onSubmit={handleVerify}
          className="bg-surface-container-low rounded-3xl p-6 space-y-4"
        >
          <ErrorAlert message={error} />
          <div className="space-y-2">
            <Label>Enter your recovery phrase</Label>
            <Textarea
              value={phraseInput}
              onChange={(e) => setPhraseInput(e.target.value)}
              rows={4}
              placeholder="word1 word2 word3 ..."
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-[11px] text-on-surface-variant">
              12 or 24 words separated by spaces. Stays entirely on this device.
            </p>
          </div>
          <Button type="submit" variant="vault" size="md" className="w-full">
            Render Recovery Kit
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-primary text-2xl md:text-3xl font-extrabold tracking-tight">
            Recovery Kit
          </h1>
          <p className="text-on-surface-variant text-sm">
            Document ID: rk-{(user?._id ?? "anon").slice(-8)}-{user?._creationTime?.toString(36).slice(-4) ?? "0000"}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => setReveal((r) => !r)}>
            {reveal ? "Hide words" : "Reveal words"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handlePrint}>
            <Icon path={ICON_PATHS.print} className="w-4 h-4" />
            Print
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setVerified(null)}>
            Re-enter
          </Button>
        </div>
      </header>

      <article className="bg-surface-container-low rounded-3xl p-8 space-y-8 print:bg-white print:shadow-none">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="font-headline text-lg font-bold text-on-surface">
              QR Recovery Token
            </h2>
            <p className="text-xs text-on-surface-variant">
              Scan with the Keeplas mobile app to restore vault access on a new device.
            </p>
            <div className="inline-block bg-white p-4 rounded-2xl">
              <QRCodeSVG value={verified.join(" ")} size={196} />
            </div>
            <p className="text-[10px] text-outline-variant uppercase tracking-[0.2em]">
              Single-use · expires after first redemption
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="font-headline text-lg font-bold text-on-surface">
              Seed Phrase ({verified.length} words)
            </h2>
            <ol className="grid grid-cols-2 gap-2">
              {verified.map((word, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-mono",
                    reveal
                      ? "border-secondary/30 bg-secondary/5"
                      : "border-outline-variant/30 bg-surface-container"
                  )}
                >
                  <span className="text-[10px] text-outline-variant w-5 text-right">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-medium">{maskWord(word, reveal)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="border-t border-outline-variant/20 pt-6 space-y-2 text-xs text-on-surface-variant">
          <p>
            <strong className="text-on-surface">Cold storage guidance.</strong> Print this
            sheet, store it inside a fire-proof safe or a bank deposit box. Never photograph
            it. Never store it in a cloud-synced folder. Keeplas cannot regenerate this
            phrase.
          </p>
          <p>
            <strong className="text-on-surface">Legal warning.</strong> Disclosure of the seed
            phrase grants full vault access. Treat it like the keys to the vault itself.
          </p>
        </div>
      </article>
    </div>
  );
}
