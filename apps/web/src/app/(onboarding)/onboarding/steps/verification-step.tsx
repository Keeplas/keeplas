"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { phraseToHash } from "@keeplas/crypto/recovery";
import { Button, Input, Label, ErrorAlert, Spinner } from "@keeplas/ui";

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

function ordinal(n: number): string {
  const pos = n + 1;
  if (pos === 1) return "1st";
  if (pos === 2) return "2nd";
  if (pos === 3) return "3rd";
  return `${pos}th`;
}

interface VerificationStepProps {
  phrase: string[];
  onVerified: () => void;
  onBack: () => void;
}

export function VerificationStep({
  phrase,
  onVerified,
  onBack,
}: VerificationStepProps) {
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
        setError(
          `The ${ordinal(indices[i])} word does not match. Please check and try again.`,
        );
        setLoading(false);
        return;
      }
    }

    // All 3 match — compute hash and store
    try {
      const hash = await phraseToHash(phrase);
      await storeHash({ recoveryPhraseHash: hash });
      onVerified();
    } catch {
      setError("An error occurred. Please try again.");
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
        Back to Recovery Words
      </button>

      {/* Header */}
      <div className="mb-8 md:mb-10">
        <span className="text-label-md text-secondary mb-2 md:mb-3 block">
          Backup Confirmation
        </span>
        <h2 className="text-headline-lg text-primary mb-3 md:mb-4 break-words">
          Verify your Recovery Words
        </h2>
        <p className="text-body-md md:text-body-lg text-on-surface-variant max-w-lg">
          To make sure you saved your words correctly, enter the 3 words below
          from your Recovery Words. This confirms your backup is complete and
          you will be able to recover your vault if needed.
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
            Why is this important?
          </h4>
          <p className="text-sm text-on-primary-container leading-relaxed">
            These 24 words are the{" "}
            <strong className="text-surface-container-lowest">only key</strong>{" "}
            that encrypts your vault — we never see them. Your password just
            authenticates you and can be reset with these same 24 words. But the
            words themselves cannot be reset: only your trusted contacts can
            recover them later via shared shards. Save them somewhere safe now.
          </p>
        </div>
      </div>

      {error && <ErrorAlert message={error} />}

      <form onSubmit={handleVerify} className="space-y-5">
        {indices.map((wordIndex, i) => (
          <div key={wordIndex} className="space-y-2">
            <Label htmlFor={`word-${wordIndex}`}>
              {ordinal(wordIndex)} word
            </Label>
            <Input
              id={`word-${wordIndex}`}
              type="text"
              value={inputs[i]}
              onChange={(e) => handleInputChange(i, e.target.value)}
              placeholder={`Enter the ${ordinal(wordIndex)} word`}
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
                Verifying...
              </>
            ) : (
              <>
                Verify and continue
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
            I need to see my Recovery Words again
          </button>
        </div>
      </form>
    </div>
  );
}
