"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { RecoveryPhraseStep } from "./steps/recovery-phrase-step";
import { VerificationStep } from "./steps/verification-step";
import { KeyGenerationStep } from "./steps/key-generation-step";

type OnboardingStep = "auth_complete" | "recovery_phrase" | "verification" | "key_generation";

interface OnboardingFlowProps {
  initialStep: string;
}

export function OnboardingFlow({ initialStep }: OnboardingFlowProps) {
  const [step, setStep] = useState<OnboardingStep>(
    (initialStep as OnboardingStep) || "auth_complete"
  );
  // The recovery phrase is held in memory only — never persisted to server
  const [phrase, setPhrase] = useState<string[] | null>(null);

  const handlePhraseGenerated = useCallback((words: string[]) => {
    setPhrase(words);
  }, []);

  const handlePhraseSaved = useCallback(() => {
    setStep("verification");
  }, []);

  const handleBackToPhrase = useCallback(() => {
    setStep("recovery_phrase");
  }, []);

  const handleVerified = useCallback(() => {
    setStep("key_generation");
  }, []);

  // Step indicator
  const steps = [
    { key: "recovery_phrase", label: "Recovery Words" },
    { key: "verification", label: "Verification" },
    { key: "key_generation", label: "Secure Vault" },
  ];

  const currentStepIndex = steps.findIndex(
    (s) => s.key === (step === "auth_complete" ? "recovery_phrase" : step)
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/logo/logo-wordmark.svg"
            alt="Keeplas"
            width={140}
            height={28}
            priority
          />
        </div>
        <div className="hidden md:flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-label transition-colors ${
                  i <= currentStepIndex
                    ? "bg-secondary text-on-secondary font-bold"
                    : "bg-surface-container text-on-surface-variant"
                }`}
              >
                <span className="text-xs font-bold">{i + 1}</span>
                <span className="text-xs tracking-wide">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`w-8 h-px ${
                    i < currentStepIndex ? "bg-secondary" : "bg-outline-variant/30"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 md:px-8">
        {(step === "auth_complete" || step === "recovery_phrase") && (
          <RecoveryPhraseStep
            phrase={phrase}
            onPhraseGenerated={handlePhraseGenerated}
            onContinue={handlePhraseSaved}
          />
        )}
        {step === "verification" && phrase && (
          <VerificationStep phrase={phrase} onVerified={handleVerified} onBack={handleBackToPhrase} />
        )}
        {step === "key_generation" && phrase && (
          <KeyGenerationStep phrase={phrase} />
        )}
      </main>
    </div>
  );
}
