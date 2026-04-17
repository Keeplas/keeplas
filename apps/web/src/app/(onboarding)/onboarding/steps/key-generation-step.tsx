"use client";

import { useEffect, useState, useRef } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@keeplas/backend/_generated/api";
import { generateMasterKey } from "@keeplas/crypto/aes";
import { uint8ToBase64 } from "@keeplas/crypto/encoding";
import { phraseToKey } from "@keeplas/crypto/recovery";
import { split } from "@keeplas/crypto/shamir";
import { useMasterKey } from "@/lib/master-key-context";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { getErrorMessage } from "@/lib/utils";
import { Button, Spinner } from "@keeplas/ui";

interface KeyGenerationStepProps {
  phrase: string[];
}

type GenerationPhase =
  | "deriving_key"
  | "splitting_shards"
  | "encrypting_bundle"
  | "storing"
  | "complete"
  | "error";

const PHASE_LABELS: Record<GenerationPhase, string> = {
  deriving_key: "Deriving your Secret Key...",
  splitting_shards: "Creating recovery fragments...",
  encrypting_bundle: "Encrypting key bundle...",
  storing: "Securing your vault...",
  complete: "Vault secured!",
  error: "An error occurred",
};

const PHASE_PROGRESS: Record<GenerationPhase, number> = {
  deriving_key: 20,
  splitting_shards: 40,
  encrypting_bundle: 60,
  storing: 80,
  complete: 100,
  error: 0,
};

export function KeyGenerationStep({ phrase }: KeyGenerationStepProps) {
  const router = useRouter();
  const { setMasterKey } = useMasterKey();
  const storeKeyBundle = useMutation(api.onboarding.storeKeyBundle);
  const [phase, setPhase] = useState<GenerationPhase>("deriving_key");
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function generateAndStore() {
      try {
        // Phase 1: Derive key from recovery phrase
        setPhase("deriving_key");
        const masterKey = await phraseToKey(phrase);

        // Store Master Key in memory for vault operations
        setMasterKey(masterKey);

        // Phase 2: Export key and split into Shamir shards
        setPhase("splitting_shards");
        const rawKey = new Uint8Array(
          await crypto.subtle.exportKey("raw", masterKey)
        );
        const shards = await split(rawKey, 5, 3);

        // Phase 3: Encrypt key bundle for storage
        // For MVP: we use a simple key wrapping approach
        // The Master Key is encrypted with a random wrapping key stored alongside
        // (In Phase 2 with Passkey, this will use the Passkey credential)
        setPhase("encrypting_bundle");

        // Generate a wrapping key for the key bundle
        const wrappingKey = await generateMasterKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedKey = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          wrappingKey,
          rawKey
        );
        const wrappingKeyRaw = new Uint8Array(
          await crypto.subtle.exportKey("raw", wrappingKey)
        );

        // Bundle: wrapping key + IV + encrypted master key
        const bundle = {
          wrappingKey: uint8ToBase64(wrappingKeyRaw),
          iv: uint8ToBase64(iv),
          encryptedMasterKey: uint8ToBase64(new Uint8Array(encryptedKey)),
        };

        // Store shard 1 in localStorage (device shard)
        const shard1Base64 = uint8ToBase64(shards[0]);
        try {
          localStorage.setItem(STORAGE_KEYS.deviceShard, shard1Base64);
        } catch {
          // localStorage may not be available — continue anyway
        }

        // Shard 5 = Keeplas shard (encrypted for Keeplas server)
        // For MVP: simple base64 encoding (post-MVP: RSA/ZK encryption)
        const keeplasShard = uint8ToBase64(shards[4]);

        // Phase 4: Store in Convex
        setPhase("storing");
        await storeKeyBundle({
          encryptedKeyBundle: JSON.stringify(bundle),
          keeplasShard,
        });

        // Clear raw key material from memory
        rawKey.fill(0);
        wrappingKeyRaw.fill(0);

        setPhase("complete");

        // Redirect to dashboard after brief delay
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      } catch (err) {
        console.error("Key generation failed:", err);
        setPhase("error");
        setError(getErrorMessage(err, "Key generation failed. Please try again."));
      }
    }

    generateAndStore();
  }, [phrase, storeKeyBundle, router, setMasterKey]);

  return (
    <div className="w-full max-w-lg mx-auto text-center">
      {/* Header */}
      <div className="mb-10">
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
              d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z"
            />
          </svg>
          <span className="font-label text-[11px] uppercase tracking-widest font-bold">
            Securing Vault
          </span>
        </div>
        <h2 className="font-headline text-3xl font-extrabold text-primary tracking-tight mb-3">
          {phase === "complete"
            ? "Your vault is ready"
            : "Setting up your protection"}
        </h2>
        <p className="text-on-surface-variant font-body max-w-sm mx-auto">
          {phase === "complete"
            ? "Your Secret Key has been generated and secured. You can now start adding items to your vault."
            : "Your Secret Key is being generated and encrypted. This happens entirely on your device."}
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="h-2 bg-surface-container-low rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-secondary to-secondary-fixed rounded-full transition-all duration-700 ease-out"
            style={{ width: `${PHASE_PROGRESS[phase]}%` }}
          />
        </div>
        <p className="text-sm text-on-surface-variant font-label">
          {PHASE_LABELS[phase]}
        </p>
      </div>

      {/* Phase indicators */}
      <div className="space-y-3 text-left max-w-sm mx-auto">
        {(
          [
            "deriving_key",
            "splitting_shards",
            "encrypting_bundle",
            "storing",
          ] as const
        ).map((p) => {
          const phaseIndex = [
            "deriving_key",
            "splitting_shards",
            "encrypting_bundle",
            "storing",
          ].indexOf(p);
          const currentIndex = [
            "deriving_key",
            "splitting_shards",
            "encrypting_bundle",
            "storing",
            "complete",
          ].indexOf(phase);
          const isDone = currentIndex > phaseIndex;
          const isCurrent = phase === p;

          return (
            <div
              key={p}
              className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                isCurrent
                  ? "bg-secondary-container/50"
                  : isDone
                    ? "bg-surface-container-low"
                    : ""
              }`}
            >
              {isDone ? (
                <svg
                  className="w-5 h-5 text-secondary shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
              ) : isCurrent ? (
                <Spinner size="md" className="shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-outline-variant/30 shrink-0" />
              )}
              <span
                className={`text-sm font-body ${
                  isDone
                    ? "text-on-surface-variant"
                    : isCurrent
                      ? "text-on-secondary-container font-medium"
                      : "text-on-surface-variant/50"
                }`}
              >
                {PHASE_LABELS[p]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Success state */}
      {phase === "complete" && (
        <div className="mt-8 p-4 bg-secondary-container/30 rounded-xl">
          <p className="text-sm text-on-secondary-container font-body">
            Redirecting to your dashboard...
          </p>
        </div>
      )}

      {/* Error state */}
      {phase === "error" && (
        <div className="mt-8">
          <div className="p-4 bg-error-container rounded-xl mb-4">
            <p className="text-sm text-on-error-container">{error}</p>
          </div>
          <Button
            variant="vault"
            size="md"
            onClick={() => window.location.reload()}
            className="cursor-pointer"
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
