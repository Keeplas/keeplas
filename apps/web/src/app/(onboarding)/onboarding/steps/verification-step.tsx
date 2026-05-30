"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import {
  derivePhraseVerifier,
  generatePhraseVerifierSalt,
} from "@keeplas/crypto/recovery";
import { uint8ToBase64 } from "@keeplas/crypto/encoding";
import { Button, Input, Label, ErrorAlert, Spinner } from "@keeplas/ui";
import { useLocale, useTranslations } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";

function pickRandomIndices(): number[] {
  const available = Array.from({ length: 24 }, (_, i) => i);
  const picked: number[] = [];
  for (let i = 0; i < 3; i++) {
    const rand = Math.floor(Math.random() * available.length);
    picked.push(available[rand]);
    available.splice(rand, 1);
  }
  return picked.sort((a, b) => a - b);
}

function ordinal(n: number, locale: Locale): string {
  const pos = n + 1;
  if (locale === "fr") return pos === 1 ? "1er" : `${pos}e`;
  const mod10 = pos % 10;
  const mod100 = pos % 100;
  if (mod10 === 1 && mod100 !== 11) return `${pos}st`;
  if (mod10 === 2 && mod100 !== 12) return `${pos}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${pos}rd`;
  return `${pos}th`;
}

interface VerificationStepProps {
  phrase: string[];
  // The per-user salt generated here (base64) is forwarded so key generation
  // reuses the SAME salt for the RootKey — one salt per user.
  onVerified: (phraseSaltB64: string) => void;
  onBack: () => void;
}

export function VerificationStep({
  phrase,
  onVerified,
  onBack,
}: VerificationStepProps) {
  const t = useTranslations("auth.onboarding.verification");
  const locale = useLocale();
  const storeHash = useMutation(api.onboarding.storeRecoveryPhraseHash);

  // Pick 3 random unique indices (stable across re-renders)
  const [indices] = useState(pickRandomIndices);

  const [inputs, setInputs] = useState(["", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleInputChange(idx: number, value: string) {
    const next = [...inputs];
    next[idx] = value;
    setInputs(next);
    setError("");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Check each word matches (case-insensitive)
    for (let i = 0; i < 3; i++) {
      const expected = phrase[indices[i]].toLowerCase();
      const actual = inputs[i].trim().toLowerCase();
      if (actual !== expected) {
        setError(t("mismatch", { ordinal: ordinal(indices[i], locale) }));
        setLoading(false);
        return;
      }
    }

    // All 3 match — derive the salted verifier and store it with its salt.
    // The phrase never leaves the device; only the Argon2id digest is sent.
    try {
      const salt = generatePhraseVerifierSalt();
      const phraseSaltB64 = uint8ToBase64(salt);
      const verifier = await derivePhraseVerifier(phrase, salt);
      await storeHash({
        recoveryPhraseHash: verifier,
        phraseSalt: phraseSaltB64,
      });
      onVerified(phraseSaltB64);
    } catch {
      setError(t("error"));
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary font-label font-bold mb-6 md:mb-8 transition-colors cursor-pointer"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
          />
        </svg>
        {t("back")}
      </button>

      {/* Header */}
      <div className="mb-8 md:mb-10">
        <span className="text-label-md text-secondary mb-2 md:mb-3 block">
          {t("badge")}
        </span>
        <h2 className="text-headline-lg text-primary mb-3 md:mb-4 break-words">
          {t("heading")}
        </h2>
        <p className="text-body-md md:text-body-lg text-on-surface-variant max-w-lg">
          {t("description")}
        </p>
      </div>

      {/* Why this matters */}
      <div className="bg-primary-container text-on-primary-container p-5 md:p-6 rounded-2xl mb-6 md:mb-8 flex items-start gap-3 md:gap-4 relative overflow-hidden">
        <svg
          className="w-8 h-8 text-secondary-fixed shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
          />
        </svg>
        <div>
          <h4 className="font-headline text-surface-container-lowest font-bold mb-1">
            {t("whyTitle")}
          </h4>
          <p className="text-sm text-on-primary-container leading-relaxed">
            {t("whyBodyBefore")}{" "}
            <strong className="text-surface-container-lowest">
              {t("whyKeyTerm")}
            </strong>{" "}
            {t("whyBodyAfter")}
          </p>
        </div>
      </div>

      {error && <ErrorAlert message={error} />}

      <form onSubmit={handleVerify} className="space-y-5">
        {indices.map((wordIndex, i) => (
          <div key={wordIndex} className="space-y-2">
            <Label htmlFor={`word-${wordIndex}`}>
              {t("wordLabel", { ordinal: ordinal(wordIndex, locale) })}
            </Label>
            <Input
              id={`word-${wordIndex}`}
              type="text"
              value={inputs[i]}
              onChange={(e) => handleInputChange(i, e.target.value)}
              placeholder={t("wordPlaceholder", {
                ordinal: ordinal(wordIndex, locale),
              })}
              required
              autoComplete="off"
              className="font-mono uppercase tracking-wider"
            />
          </div>
        ))}

        <div className="pt-2 space-y-3">
          <Button
            type="submit"
            variant="vault"
            size="xl"
            disabled={loading || inputs.some((v) => !v.trim())}
            className="w-full group cursor-pointer disabled:pointer-events-none disabled:opacity-40"
          >
            {loading ? (
              <>
                <Spinner
                  size="md"
                  className="border-on-primary border-t-transparent"
                />
                {t("verifying")}
              </>
            ) : (
              <>
                {t("verifyContinue")}
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
              </>
            )}
          </Button>

          <button
            type="button"
            onClick={onBack}
            className="w-full text-center text-sm text-on-surface-variant hover:text-primary font-label font-semibold py-3 transition-colors cursor-pointer"
          >
            {t("seeAgain")}
          </button>
        </div>
      </form>
    </div>
  );
}
