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
}

export function VerificationStep({ phrase, onVerified }: VerificationStepProps) {
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
    <div className="w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-container text-on-secondary-container rounded-lg mb-6">
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
              d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
            />
          </svg>
          <span className="font-label text-[11px] uppercase tracking-widest font-bold">
            Verification
          </span>
        </div>
        <h2 className="font-headline text-3xl font-extrabold text-primary tracking-tight mb-3">
          Verify your Recovery Words
        </h2>
        <p className="text-on-surface-variant font-body max-w-sm mx-auto">
          Enter the following 3 words from your Recovery Words to confirm you
          saved them correctly.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-xl bg-error-container text-on-error-container text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-6">
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

        <button
          type="submit"
          disabled={loading || inputs.some((v) => !v.trim())}
          className="w-full vault-gradient text-on-primary font-headline font-bold py-4 rounded-xl shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-40 disabled:pointer-events-none"
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
      </form>
    </div>
  );
}
