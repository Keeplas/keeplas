"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { phraseToHash } from "@keeplas/crypto/recovery";

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

export function VerificationStep({ phrase, onVerified, onBack }: VerificationStepProps) {
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
          `The ${ordinal(indices[i])} word does not match. Please check and try again.`
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
        className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary font-label font-bold mb-8 transition-colors cursor-pointer"
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
      <div className="mb-10">
        <span className="font-label text-secondary font-semibold uppercase tracking-[0.2em] text-xs mb-3 block">
          Backup Confirmation
        </span>
        <h2 className="font-headline text-3xl md:text-4xl font-extrabold text-primary tracking-tight mb-4">
          Verify your Recovery Words
        </h2>
        <p className="text-on-surface-variant font-body text-base leading-relaxed max-w-lg">
          To make sure you saved your words correctly, enter the 3 words below
          from your Recovery Words. This confirms your backup is complete and
          you will be able to recover your vault if needed.
        </p>
      </div>

      {/* Why this matters */}
      <div className="bg-primary-container text-on-primary-container p-6 rounded-2xl mb-8 flex items-start gap-4 relative overflow-hidden">
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
            Keeplas uses zero-knowledge encryption — we never store your
            Recovery Words. If you lose access to all your devices, these words
            are the <strong className="text-surface-container-lowest">only way</strong>{" "}
            to recover your vault. There is no &ldquo;forgot password&rdquo; option. This
            verification ensures you have a working backup before we proceed.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-error-container text-on-error-container text-sm flex items-start gap-3">
          <svg
            className="w-5 h-5 shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
          {error}
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-5">
        {indices.map((wordIndex, i) => (
          <div key={wordIndex} className="space-y-2">
            <label
              htmlFor={`word-${wordIndex}`}
              className="font-label text-xs uppercase tracking-[0.1em] font-bold text-on-surface-variant ml-1"
            >
              {ordinal(wordIndex)} word
            </label>
            <input
              id={`word-${wordIndex}`}
              type="text"
              value={inputs[i]}
              onChange={(e) => handleInputChange(i, e.target.value)}
              placeholder={`Enter the ${ordinal(wordIndex)} word`}
              required
              autoComplete="off"
              className="w-full bg-surface-container-low border border-transparent rounded-xl px-4 py-3 text-on-surface placeholder:text-outline-variant focus:border-secondary/15 focus:bg-surface-container-high transition-all focus:outline-none font-mono uppercase tracking-wider"
            />
          </div>
        ))}

        <div className="pt-2 space-y-3">
          <button
            type="submit"
            disabled={loading || inputs.some((v) => !v.trim())}
            className="w-full vault-gradient text-on-primary font-headline font-bold py-4 rounded-xl shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-on-primary border-t-transparent animate-spin" />
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
          </button>

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
