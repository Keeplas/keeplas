import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";

export const metadata: Metadata = {
  title: "Security & Zero-Knowledge — Keeplas",
  description:
    "How Keeplas keeps your vault private — authentication, zero-knowledge encryption, device unlock, and recovery.",
};

interface PillarSectionProps {
  icon: string;
  badge: string;
  title: string;
  intro: string;
  bullets: string[];
  technical: { title: string; lines: string[] };
}

function PillarSection({
  icon,
  badge,
  title,
  intro,
  bullets,
  technical,
}: PillarSectionProps) {
  return (
    <section className="bg-surface-container-lowest p-6 md:p-8 rounded-2xl ghost-border space-y-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
          <Icon path={icon} className="w-6 h-6" />
        </div>
        <div>
          <span className="text-label-md text-secondary uppercase tracking-widest">
            {badge}
          </span>
          <h2 className="text-headline-md text-primary mt-1">{title}</h2>
        </div>
      </div>

      <p className="text-body-lg text-on-surface-variant">{intro}</p>

      <ul className="space-y-3">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-3">
            <Icon
              path={ICON_PATHS.checkCircle}
              className="w-5 h-5 text-secondary-fixed-dim shrink-0 mt-0.5"
            />
            <span className="text-body-md text-on-surface">{b}</span>
          </li>
        ))}
      </ul>

      <details className="group bg-surface-container/40 rounded-xl">
        <summary className="cursor-pointer p-4 text-label-md text-primary font-bold flex items-center justify-between">
          <span>{technical.title}</span>
          <Icon
            path={ICON_PATHS.chevronRight}
            className="w-4 h-4 text-on-surface-variant transition-transform group-open:rotate-90"
          />
        </summary>
        <div className="px-4 pb-4 space-y-2">
          {technical.lines.map((line) => (
            <p
              key={line}
              className="text-body-md text-on-surface-variant font-mono leading-relaxed"
            >
              {line}
            </p>
          ))}
        </div>
      </details>
    </section>
  );
}

interface FaqItemProps {
  question: string;
  answer: string;
}

function FaqItem({ question, answer }: FaqItemProps) {
  return (
    <details className="group bg-surface-container-lowest rounded-2xl ghost-border">
      <summary className="cursor-pointer p-5 flex items-center justify-between gap-4">
        <span className="text-body-lg text-primary font-bold">{question}</span>
        <Icon
          path={ICON_PATHS.plus}
          className="w-5 h-5 text-on-surface-variant transition-transform group-open:rotate-45 shrink-0"
        />
      </summary>
      <p className="px-5 pb-5 text-body-md text-on-surface-variant leading-relaxed">
        {answer}
      </p>
    </details>
  );
}

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-6 py-16 md:py-24 space-y-12">
        {/* Hero */}
        <header className="space-y-4 text-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-lowest rounded-full shadow-sm">
              <Icon
                path={ICON_PATHS.shieldCheck}
                className="w-5 h-5 text-secondary"
              />
              <span className="text-label-md text-primary">
                Security & Privacy
              </span>
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full shadow-sm">
              <Icon path={ICON_PATHS.lock} className="w-5 h-5" />
              <span className="text-label-md font-bold">
                Quantum-safe end-to-end
              </span>
            </span>
          </div>
          <h1 className="text-display-md md:text-display-lg text-primary">
            How Keeplas protects your vault
          </h1>
          <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">
            Four pillars: how you sign in, how your data is encrypted, how
            you unlock day-to-day, and what happens if you lose access. We
            see encrypted bytes — never your data. Every per-recipient key
            is wrapped with a NIST post-quantum KEM, so a future quantum
            computer cannot retroactively break what we hold today.
          </p>
        </header>

        {/* Pillars */}
        <PillarSection
          icon={ICON_PATHS.user}
          badge="Pillar 1"
          title="Authentication"
          intro="Email and password sign you in — nothing more. Optional two-factor authentication blocks phishing. Your password never participates in encryption, so resetting it doesn't risk your data."
          bullets={[
            "Email + password to sign in.",
            "Optional TOTP (Google Authenticator, 1Password, Authy…) for 2FA.",
            "Lost your password? Reset it with your 24 recovery words. Your vault stays untouched.",
            "Lost your authenticator? Reset 2FA with your 24 recovery words.",
          ]}
          technical={{
            title: "How it works (technical)",
            lines: [
              "Convex Auth · scrypt password hashing server-side",
              "TOTP · RFC 6238 · 30s window · base32 secret never leaves the backend after enrollment",
              "Reset path · SHA-256(phrase) verifier matches users.recoveryPhraseHash → modify scrypt hash",
            ],
          }}
        />

        <PillarSection
          icon={ICON_PATHS.lock}
          badge="Pillar 2"
          title="Zero-Knowledge Encryption"
          intro="Your vault is encrypted on your device, before anything reaches our servers. The keys are derived from 24 recovery words that you alone hold — we never see them, store them, or transmit them. Per-recipient sharing uses a NIST post-quantum KEM, so even a future quantum adversary cannot retroactively decrypt what we hold."
          bullets={[
            "24 BIP-39 words generated locally during onboarding.",
            "Argon2id derives a RootKey from your words + a per-user public salt.",
            "RootKey wraps a per-vault MasterKey (AES-256-GCM).",
            "Per-recipient key wrapping uses ML-KEM-768 (NIST FIPS 203) — quantum-resistant against future quantum computers.",
            "We see only encrypted envelopes and the public salt. Even if our database leaked, your data stays opaque.",
          ]}
          technical={{
            title: "How it works (technical)",
            lines: [
              "Phrase → Argon2id(memorySize 19 MiB, iterations 2, parallelism 1, hashLength 32) → RootKey",
              "MasterKey · AES-256-GCM · randomly generated, never shared in cleartext",
              "encryptedKeyBundle · { phraseSalt, iv, encryptedMasterKey }",
              "Recipient encryption · ML-KEM-768 (NIST FIPS 203, August 2024) · KEM-DEM with AES-256-GCM",
              "Vault items · per-item DEK wrapped by MasterKey · all encryption in WebCrypto + @noble/post-quantum client-side",
            ],
          }}
        />

        <PillarSection
          icon={ICON_PATHS.fingerprint}
          badge="Pillar 3"
          title="Device Unlock"
          intro="Typing 24 words at every login is brutal. After your first login on a device, you can save a faster local unlock — choose any combination. Each method stays on this device only and never syncs."
          bullets={[
            "PIN (6+ digits) protected by Argon2id with brute-force lockout.",
            "Biometric — Face ID, Touch ID, Windows Hello — via WebAuthn + PRF extension.",
            "Hardware security key — YubiKey or any FIDO2 authenticator with PRF.",
            "All three can coexist. Lose the device? Re-enter your 24 words on a new one.",
          ]}
          technical={{
            title: "How it works (technical)",
            lines: [
              "PIN · Argon2id(secret, deviceSalt) → wrapKey → AES-GCM(MasterKey)",
              "Biometric / Hardware key · WebAuthn createCredential with prf:{eval:{first:salt}} extension",
              "PRF output → AES-256-GCM wrapKey → wraps MasterKey · stored in IndexedDB",
              "Lockout · 5 wrong PIN attempts → 60s freeze · 10 → entry wiped, 24-word re-entry required",
            ],
          }}
        />

        <PillarSection
          icon={ICON_PATHS.users}
          badge="Pillar 4"
          title="Recovery"
          intro="Your 24 words are the only secret without a server-side reset path. If you lose them, only your trusted contacts can help — through Shamir Secret Sharing wrapped with a post-quantum KEM. We have no master key. No backdoor."
          bullets={[
            "Lost password → reset with your 24 words. Vault unaffected.",
            "Lost 2FA → reset with your 24 words.",
            "Lost the 24 words → trusted contacts hold encrypted shards. A quorum can reconstruct.",
            "Trusted-contact shards are wrapped with ML-KEM-768, so even harvest-now-decrypt-later attacks fail decades from now.",
            "Posthumous continuity → trusted contacts gain access via configurable life-check failures.",
          ]}
          technical={{
            title: "How it works (technical)",
            lines: [
              "Shamir Secret Sharing · 5 shards · threshold 3 to reconstruct MasterKey",
              "Shards · 1 local · 1 Keeplas custodian · 3 distributed to trusted contacts (ML-KEM-768 + AES-256-GCM wrapped to each contact's public key)",
              "Recovery phrase verification · SHA-256(phrase) compared server-side · phrase never sent",
              "No master key, no escrow, no employee or court-ordered access path",
            ],
          }}
        />

        {/* FAQ */}
        <section className="space-y-4">
          <h2 className="text-headline-md text-primary text-center">
            Frequently asked
          </h2>
          <div className="space-y-3">
            <FaqItem
              question="What if Keeplas gets hacked?"
              answer="Attackers would see encrypted bundles, public salts, and server-side scrypt password hashes. None of these alone reveal your vault. Without your 24 words (held only by you) or a quorum of your trusted contacts' shards, the data stays unreadable."
            />
            <FaqItem
              question="What if Keeplas shuts down?"
              answer="Your vault on-device contains your decrypted MasterKey while you're logged in — you can export everything. We will publish the encryption format so any developer can decrypt your bundle from your 24 words alone, with no Keeplas involvement."
            />
            <FaqItem
              question="What if I die or become incapacitated?"
              answer="That's the core mission. You configure trusted contacts and a life-check protocol. After confirmed inactivity, your trusted contacts can recover the vault using their distributed shards. You decide who, what, and when."
            />
            <FaqItem
              question="Can a court force you to hand over my data?"
              answer="We can hand over what we have: encrypted bundles. We cannot decrypt them. We do not hold your password reset path, your 24 words, or your MasterKey. The architecture removes the option of complying."
            />
            <FaqItem
              question="Why do I need a password if my data is encrypted by 24 words?"
              answer="Two layers. The password authenticates you to our servers (so attackers cannot just guess emails to access encrypted bundles). The 24 words encrypt the data itself. Both are needed at first login on a new device — afterward, your device unlock takes over."
            />
            <FaqItem
              question="What encryption algorithms do you use?"
              answer="Argon2id (OWASP 2024 params) for key derivation, AES-256-GCM for symmetric encryption, ML-KEM-768 (NIST FIPS 203, the post-quantum KEM standardized in August 2024) for wrapping per-recipient keys, SHA-256 for verifiers, and Shamir Secret Sharing over GF(256) for trusted-contact recovery. Cryptography runs client-side via the Web Crypto API and @noble/post-quantum."
            />
            <FaqItem
              question="Are you quantum-safe?"
              answer="Yes, end-to-end. Symmetric primitives (AES-256-GCM, Argon2id, SHA-256, Shamir Secret Sharing) are all quantum-resistant by construction. The asymmetric layer — used to wrap per-recipient keys and trusted-contact shards — uses ML-KEM-768, the NIST-standardized post-quantum KEM (FIPS 203, August 2024). This blocks the harvest-now-decrypt-later threat: data we store today stays opaque even to a future adversary running Shor's algorithm on a large quantum computer. Most password managers (Bitwarden, 1Password) have not yet migrated; we built Keeplas post-quantum from day one because vault data must stay confidential for decades."
            />
          </div>
        </section>

        {/* CTA */}
        <footer className="text-center space-y-4 pt-8">
          <p className="text-body-lg text-on-surface-variant">
            Ready to set up your vault?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="vault-gradient text-white px-8 py-3 rounded-xl font-bold inline-flex items-center justify-center gap-2 shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
            >
              Create your vault
              <Icon path={ICON_PATHS.arrowRight} className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="text-secondary px-8 py-3 font-bold hover:underline"
            >
              I already have one
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
