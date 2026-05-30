"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { LegalInfoStep } from "./steps/legal-info-step";
import { RecoveryPhraseStep } from "./steps/recovery-phrase-step";
import { VerificationStep } from "./steps/verification-step";
import { KeyGenerationStep } from "./steps/key-generation-step";
import { PasskeyStep } from "./steps/passkey-step";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslations } from "@/lib/i18n";

type OnboardingStep =
  | "auth_complete"
  | "legal_info"
  | "recovery_phrase"
  | "verification"
  | "key_generation"
  | "passkey";

interface OnboardingFlowProps {
  initialStep: string;
}

export function OnboardingFlow({ initialStep }: OnboardingFlowProps) {
  const [step, setStep] = useState<OnboardingStep>(
    (initialStep as OnboardingStep) || "auth_complete",
  );
  const t = useTranslations("auth.onboarding.steps");
  // The recovery phrase is held in memory only — never persisted to server
  const [phrase, setPhrase] = useState<string[] | null>(null);
  // Per-user Argon2id salt (base64) generated at verification. Reused by key
  // generation so the RootKey and the recovery-phrase verifier share one salt.
  const [phraseSaltB64, setPhraseSaltB64] = useState<string | null>(null);

  const handleLegalInfoConfirmed = useCallback(() => {
    setStep("recovery_phrase");
  }, []);

  const handlePhraseGenerated = useCallback((words: string[]) => {
    setPhrase(words);
  }, []);

  const handlePhraseSaved = useCallback(() => {
    setStep("verification");
  }, []);

  const handleBackToPhrase = useCallback(() => {
    setStep("recovery_phrase");
  }, []);

  const handleVerified = useCallback((saltB64: string) => {
    setPhraseSaltB64(saltB64);
    setStep("key_generation");
  }, []);

  const handleVaultReady = useCallback(() => {
    setStep("passkey");
  }, []);

  // Step indicator
  const steps = [
    { key: "legal_info", label: t("identity") },
    { key: "recovery_phrase", label: t("recoveryPhrase") },
    { key: "verification", label: t("verification") },
    { key: "key_generation", label: t("keyGeneration") },
    { key: "passkey", label: t("passkey") },
  ];

  // `auth_complete` is the post-signup landing state — treat it as the first
  // legal_info step since the user has not yet confirmed their identity.
  const visualKey = step === "auth_complete" ? "legal_info" : step;
  const currentStepIndex = steps.findIndex((s) => s.key === visualKey);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-6 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <Image
            src="/assets/logo/logo-wordmark.svg"
            alt="Keeplas"
            width={200}
            height={40}
            priority
            className="h-9 md:h-11 w-auto"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 w-full sm:w-auto overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            {steps.map((s, i) => (
              <div
                key={s.key}
                className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0"
              >
                <div
                  className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg font-label transition-colors ${
                    i <= currentStepIndex
                      ? "bg-secondary text-on-secondary font-bold"
                      : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  <span className="text-[10px] md:text-xs font-bold">
                    {i + 1}
                  </span>
                  <span className="text-[10px] md:text-xs tracking-wide whitespace-nowrap">
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`w-3 sm:w-5 md:w-8 h-px shrink-0 ${
                      i < currentStepIndex
                        ? "bg-secondary"
                        : "bg-outline-variant/30"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <LanguageSwitcher className="shrink-0" />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-6 md:py-8 md:px-8">
        {(step === "auth_complete" || step === "legal_info") && (
          <LegalInfoStep onComplete={handleLegalInfoConfirmed} />
        )}
        {step === "recovery_phrase" && (
          <RecoveryPhraseStep
            phrase={phrase}
            onPhraseGenerated={handlePhraseGenerated}
            onContinue={handlePhraseSaved}
          />
        )}
        {step === "verification" && phrase && (
          <VerificationStep
            phrase={phrase}
            onVerified={handleVerified}
            onBack={handleBackToPhrase}
          />
        )}
        {step === "key_generation" && phrase && phraseSaltB64 && (
          <KeyGenerationStep
            phrase={phrase}
            phraseSaltB64={phraseSaltB64}
            onComplete={handleVaultReady}
          />
        )}
        {step === "passkey" && <PasskeyStep />}
      </main>
    </div>
  );
}
