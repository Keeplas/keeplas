"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Switch } from "@keeplas/ui";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
import { DEFAULT_SECURITY, type SecurityPrefs } from "./constants";

export function SecuritySection() {
  const { signOut } = useAuthActions();
  const [security, setSecurity] = useLocalStorageState<SecurityPrefs>(
    STORAGE_KEYS.security,
    DEFAULT_SECURITY
  );

  function toggle(key: keyof SecurityPrefs) {
    setSecurity((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <section
      id="security"
      className="scroll-mt-32 flex flex-col md:flex-row gap-8 md:gap-10 items-start"
    >
      <div className="md:w-1/3 md:sticky md:top-20">
        <h2 className="text-primary font-headline text-xl font-bold tracking-tight mb-3">
          Fortress Protocol
        </h2>
        <p className="text-sm text-on-surface-variant leading-relaxed mb-5">
          Security is the bedrock of The Vault. Enable biometric layers for instantaneous yet unbreakable access.
        </p>
        <div className="p-5 bg-primary-container rounded-2xl text-on-primary-container space-y-3">
          <div className="flex items-center gap-3">
            <svg
              className="w-4 h-4 text-secondary-fixed"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4Zm-1 16-4-4 1.41-1.41L11 14.17l5.59-5.59L18 10l-7 7Z" />
            </svg>
            <span className="font-bold font-headline text-[11px] uppercase tracking-widest text-on-primary">
              Sentinel Active
            </span>
          </div>
          <p className="text-xs text-on-primary-container leading-loose">
            Your vault is currently protected by 256-bit AES encryption and zero-knowledge cryptography.
          </p>
        </div>
      </div>

      <div className="md:w-2/3 space-y-5 flex-1">
        <div className="bg-surface-container-low rounded-2xl overflow-hidden">
          <SecurityRow
            title="Two-Factor Authentication"
            description="Recommended for all high-value legacies."
            checked={security.twoFactor}
            onToggle={() => toggle("twoFactor")}
          />
          <Divider />
          <SecurityRow
            title="Biometric Access"
            description="Unlock your vault using FaceID or TouchID."
            checked={security.biometric}
            onToggle={() => toggle("biometric")}
          />
          <Divider />
          <div className="p-6 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="font-headline font-bold text-primary text-sm">
                Hardware Key Support
              </p>
              <p className="text-xs text-on-surface-variant">
                Register a physical YubiKey or Titan key.
              </p>
            </div>
            <button className="text-secondary font-headline text-[11px] font-bold uppercase tracking-widest hover:underline cursor-pointer">
              Manage Keys
            </button>
          </div>
        </div>

        <button className="w-full p-5 bg-surface-container-high rounded-2xl flex items-center justify-between group hover:bg-surface-container-highest transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-primary"
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
            <span className="font-headline font-bold text-primary text-sm">
              Reset Master Password
            </span>
          </div>
          <ChevronRight />
        </button>

        <button
          onClick={() => signOut()}
          className="w-full p-5 bg-error-container/40 rounded-2xl flex items-center justify-between group hover:bg-error-container/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-error"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
              />
            </svg>
            <span className="font-headline font-bold text-error text-sm">
              Sign out of this session
            </span>
          </div>
          <ChevronRight tone="error" />
        </button>
      </div>
    </section>
  );
}

interface SecurityRowProps {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}

function SecurityRow({ title, description, checked, onToggle }: SecurityRowProps) {
  return (
    <div className="p-6 flex items-center justify-between">
      <div className="space-y-0.5">
        <p className="font-headline font-bold text-primary text-sm">{title}</p>
        <p className="text-xs text-on-surface-variant">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-outline-variant/15 mx-6" />;
}

function ChevronRight({ tone }: { tone?: "error" }) {
  const colorClass =
    tone === "error" ? "text-error/60" : "text-on-surface-variant";
  return (
    <svg
      className={`w-4 h-4 ${colorClass} group-hover:translate-x-1 transition-transform`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m8.25 4.5 7.5 7.5-7.5 7.5"
      />
    </svg>
  );
}
