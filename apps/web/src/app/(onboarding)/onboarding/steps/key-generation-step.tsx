"use client";

import { useEffect, useState, useRef } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@keeplas/backend/_generated/api";
import { generateMasterKey } from "@keeplas/crypto/aes";
import { uint8ToBase64 } from "@keeplas/crypto/encoding";
import { deriveRootKey } from "@keeplas/crypto/kdf";
import { split } from "@keeplas/crypto/shamir";
import { useMasterKey } from "@/lib/master-key-context";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { getErrorMessage } from "@/lib/utils";
import { Button, Spinner } from "@keeplas/ui";

interface KeyGenerationStepProps {
  phrase: string[];
  onComplete?: () => void;
}

type GenerationPhase =
  | "deriving_root"
  | "splitting_shards"
  | "wrapping_master_key"
  | "storing"
  | "complete"
  | "error";

const PHASE_LABELS: Record<GenerationPhase, string> = {
  deriving_root: "Deriving your Root Key from your 24 words...",
  splitting_shards: "Creating recovery fragments...",
  wrapping_master_key: "Sealing your Master Key...",
  storing: "Securing your vault...",
  complete: "Vault secured!",
  error: "An error occurred",
};

const PHASE_PROGRESS: Record<GenerationPhase, number> = {
  deriving_root: 25,
  splitting_shards: 50,
  wrapping_master_key: 75,
  storing: 90,
  complete: 100,
  error: 0,
};

const VISIBLE_PHASES = [
  "deriving_root",
  "splitting_shards",
  "wrapping_master_key",
  "storing",
] as const;

const MIN_THRESHOLD = 2;
const MAX_THRESHOLD = 5;
const DEFAULT_THRESHOLD = 2;

export function KeyGenerationStep({ phrase, onComplete }: KeyGenerationStepProps) {
  const router = useRouter();
  const { setMasterKey } = useMasterKey();
  const storeKeyBundle = useMutation(api.onboarding.storeKeyBundle);
  const [phase, setPhase] = useState<GenerationPhase>("deriving_root");
  const [error, setError] = useState("");
  const [threshold, setThreshold] = useState<number | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (threshold === null) return;
    startedRef.current = true;
    const chosenThreshold = threshold;

    async function generateAndStore() {
      try {
        // Phase 1: derive RootKey from the 24 words via Argon2id with a
        // freshly generated user-specific salt. The phrase never leaves the
        // client; the server stores only the salt.
        setPhase("deriving_root");
        const phraseSalt = crypto.getRandomValues(new Uint8Array(16));
        const rootKey = await deriveRootKey(phrase, phraseSalt, {
          extractable: false,
        });

        // Phase 2: generate a fresh MasterKey, then Shamir-split it for
        // trusted-contact recovery. RootKey wraps MasterKey; trusted-contact
        // shards reconstruct the MasterKey directly without RootKey. The
        // threshold (chosen by the user) controls how many shares are needed
        // to reconstruct.
        const masterKey = await generateMasterKey();
        const rawMasterKey = new Uint8Array(
          await crypto.subtle.exportKey("raw", masterKey)
        );

        setPhase("splitting_shards");
        const shards = await split(rawMasterKey, 5, chosenThreshold);

        // Phase 3: wrap MasterKey with RootKey -> bundle stored on the server
        setPhase("wrapping_master_key");
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const wrapped = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          rootKey,
          rawMasterKey
        );

        const phraseSaltB64 = uint8ToBase64(phraseSalt);
        const bundle = {
          version: 2,
          phraseSalt: phraseSaltB64,
          iv: uint8ToBase64(iv),
          encryptedMasterKey: uint8ToBase64(new Uint8Array(wrapped)),
        };

        // Shard 1 stays on this device; shard 5 is the Keeplas custodian
        // shard. Shards 2–4 are reserved for trusted contacts (later step).
        const shard1Base64 = uint8ToBase64(shards[0]);
        try {
          localStorage.setItem(STORAGE_KEYS.deviceShard, shard1Base64);
        } catch {
          // localStorage may be unavailable (private mode) — non-fatal.
        }
        const keeplasShard = uint8ToBase64(shards[4]);

        // Phase 4: persist
        setPhase("storing");
        await storeKeyBundle({
          encryptedKeyBundle: JSON.stringify(bundle),
          phraseSalt: phraseSaltB64,
          keeplasShard,
          vaultThreshold: chosenThreshold,
        });

        // Keep the live MasterKey for the rest of the session.
        setMasterKey(masterKey);

        // Wipe sensitive raw bytes from memory.
        rawMasterKey.fill(0);

        setPhase("complete");

        setTimeout(() => {
          if (onComplete) {
            onComplete();
          } else {
            router.push("/dashboard");
          }
        }, 1500);
      } catch (err) {
        console.error("Key generation failed:", err);
        setPhase("error");
        setError(getErrorMessage(err, "Key generation failed. Please try again."));
      }
    }

    generateAndStore();
  }, [phrase, storeKeyBundle, router, setMasterKey, onComplete, threshold]);

  if (threshold === null) {
    return (
      <ThresholdPicker
        onSelect={setThreshold}
        defaultValue={DEFAULT_THRESHOLD}
      />
    );
  }

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
          <span className="text-label-md">
            Securing Vault
          </span>
        </div>
        <h2 className="text-headline-lg text-primary mb-3 break-words">
          {phase === "complete"
            ? "Your vault is ready"
            : "Setting up your protection"}
        </h2>
        <p className="text-body-md md:text-body-lg text-on-surface-variant max-w-sm mx-auto">
          {phase === "complete"
            ? "Your Master Key is sealed by your 24 words. You can now start adding items to your vault."
            : "Your keys are derived and sealed entirely on your device. We never see your phrase."}
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
        {VISIBLE_PHASES.map((p) => {
          const phaseIndex = VISIBLE_PHASES.indexOf(p);
          const currentIndex = [...VISIBLE_PHASES, "complete" as const].indexOf(
            phase as (typeof VISIBLE_PHASES)[number] | "complete"
          );
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

interface ThresholdPickerProps {
  onSelect: (threshold: number) => void;
  defaultValue: number;
}

function ThresholdPicker({ onSelect, defaultValue }: ThresholdPickerProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-headline-lg text-primary mb-3 break-words">
          Recovery threshold
        </h2>
        <p className="text-body-md md:text-body-lg text-on-surface-variant max-w-md mx-auto">
          How many trusted contacts must agree to reconstruct your vault when
          you become unreachable. Lower = easier recovery, higher = stronger
          against collusion.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {Array.from(
          { length: MAX_THRESHOLD - MIN_THRESHOLD + 1 },
          (_, i) => i + MIN_THRESHOLD
        ).map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              onClick={() => setValue(n)}
              className={`p-4 rounded-2xl border-2 transition-all text-center cursor-pointer ${
                selected
                  ? "border-secondary bg-secondary-container/40"
                  : "border-outline-variant/30 hover:border-outline-variant/60 bg-surface-container-low"
              }`}
            >
              <div className="text-headline-md text-primary font-bold">
                {n}
              </div>
              <div className="text-label-md text-on-surface-variant">
                of 5
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-4 bg-surface-container-low rounded-xl mb-6">
        <p className="text-body-md text-on-surface-variant">
          {value === 2 && (
            <>
              <strong className="text-primary">Easiest recovery.</strong> Any
              two contacts can collaborate. Recommended unless your contacts
              face a high collusion risk.
            </>
          )}
          {value === 3 && (
            <>
              <strong className="text-primary">Balanced.</strong> Any three
              contacts must collaborate. Resistant to single-pair collusion.
            </>
          )}
          {value === 4 && (
            <>
              <strong className="text-primary">Strict.</strong> Four out of
              five contacts must agree. Very strong, but recovery may be hard
              if some contacts are unavailable.
            </>
          )}
          {value === 5 && (
            <>
              <strong className="text-primary">Maximum.</strong> All five
              contacts must agree. No collusion possible, but a single
              unreachable contact blocks recovery permanently.
            </>
          )}
        </p>
      </div>

      <Button
        variant="vault"
        size="lg"
        onClick={() => onSelect(value)}
        className="w-full cursor-pointer"
      >
        Continue with {value}-of-5
      </Button>
    </div>
  );
}
