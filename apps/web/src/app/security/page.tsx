import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { BackButton } from "./back-button";

export const metadata: Metadata = {
  title: "Security & Zero-Knowledge — Keeplas",
  description:
    "How Keeplas keeps your vault private — authentication, zero-knowledge encryption, device unlock, recovery, and the legally-admissible audit trail.",
};

interface Reference {
  label: string;
  url: string;
  note?: string;
}

interface PillarSectionProps {
  icon: string;
  badge: string;
  title: string;
  intro: string;
  bullets: string[];
  technical: { title: string; lines: string[] };
  references?: Reference[];
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-secondary font-bold hover:underline"
    >
      {children}
      <Icon path={ICON_PATHS.openInNew} className="w-3.5 h-3.5" aria-hidden />
    </a>
  );
}

function ReferenceList({ items }: { items: Reference[] }) {
  return (
    <div className="border-t border-outline-variant/20 mt-4 pt-4">
      <p className="text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
        External references
      </p>
      <ul className="space-y-2">
        {items.map((ref) => (
          <li
            key={ref.url}
            className="text-body-md text-on-surface-variant leading-relaxed"
          >
            <ExternalLink href={ref.url}>{ref.label}</ExternalLink>
            {ref.note && (
              <span className="text-on-surface-variant/80"> — {ref.note}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PillarSection({
  icon,
  badge,
  title,
  intro,
  bullets,
  technical,
  references,
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
          {references && references.length > 0 && (
            <ReferenceList items={references} />
          )}
        </div>
      </details>
    </section>
  );
}

interface FaqItemProps {
  question: string;
  answer: React.ReactNode;
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
      <div className="px-5 pb-5 text-body-md text-on-surface-variant leading-relaxed">
        {answer}
      </div>
    </details>
  );
}

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-6 py-16 md:py-24 space-y-12">
        <BackButton />
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
            Five pillars: how you sign in, how your data is encrypted, how you
            unlock day-to-day, what happens if you lose access, and the
            tamper-evident audit trail that makes Keeplas usable as evidence in
            succession proceedings. We see encrypted bytes — never your data.
            Every per-recipient key is wrapped with a NIST post-quantum KEM, so
            a future quantum computer cannot retroactively break what we hold
            today.
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
              "Reset path · salted Argon2id(phrase) verifier matches users.recoveryPhraseHash (constant-time) → modify scrypt hash",
            ],
          }}
          references={[
            {
              label: "Convex Auth",
              url: "https://labs.convex.dev/auth",
              note: "Open-source auth library used for password + TOTP + WebAuthn",
            },
            {
              label: "RFC 6238 — TOTP",
              url: "https://datatracker.ietf.org/doc/html/rfc6238",
              note: "Time-based One-Time Password algorithm",
            },
            {
              label: "RFC 7914 — scrypt",
              url: "https://datatracker.ietf.org/doc/html/rfc7914",
              note: "Memory-hard password hashing function",
            },
          ]}
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
          references={[
            {
              label: "BIP-39 — Mnemonic recovery phrases",
              url: "https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki",
              note: "The 24-word format and English wordlist we use",
            },
            {
              label: "RFC 9106 — Argon2",
              url: "https://www.rfc-editor.org/rfc/rfc9106.html",
              note: "Memory-hard KDF (Argon2id is the Password Hashing Competition winner)",
            },
            {
              label: "OWASP — Argon2id parameter guidance",
              url: "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id",
              note: "Source of our 19 MiB / 2 iterations / 1 parallelism settings",
            },
            {
              label: "NIST FIPS 203 — ML-KEM",
              url: "https://csrc.nist.gov/pubs/fips/203/final",
              note: "Post-quantum KEM standard (finalized August 2024)",
            },
            {
              label: "NIST SP 800-38D — AES-GCM",
              url: "https://csrc.nist.gov/pubs/sp/800/38/d/final",
              note: "Authenticated symmetric encryption mode",
            },
            {
              label: "@noble/post-quantum",
              url: "https://github.com/paulmillr/noble-post-quantum",
              note: "Audited TypeScript implementation of ML-KEM-768",
            },
            {
              label: "W3C Web Crypto API",
              url: "https://www.w3.org/TR/WebCryptoAPI/",
              note: "Browser-native primitives we rely on for AES-GCM and HKDF",
            },
          ]}
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
            "Inactivity auto-lock: after 20 minutes with no activity the vault locks itself, wiping the in-memory and on-device keys until you unlock again.",
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
          references={[
            {
              label: "W3C WebAuthn Level 3",
              url: "https://www.w3.org/TR/webauthn-3/",
              note: "The browser API behind passkeys and security keys",
            },
            {
              label: "WebAuthn PRF extension",
              url: "https://www.w3.org/TR/webauthn-3/#prf-extension",
              note: "Lets a passkey deterministically derive an unlock key without exposing the credential",
            },
            {
              label: "FIDO2",
              url: "https://fidoalliance.org/fido2/",
              note: "The alliance behind the hardware-key standards we support",
            },
          ]}
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
              "Shamir Secret Sharing · 4 shards · threshold 2–3 to reconstruct MasterKey",
              "Shards · 1 local · 3 distributed to trusted contacts (ML-KEM-768 + AES-256-GCM wrapped to each contact's public key) · Keeplas holds NO shard",
              "Recovery phrase verification · SHA-256(phrase) compared server-side · phrase never sent",
              "No master key, no escrow, no employee or court-ordered access path",
            ],
          }}
          references={[
            {
              label: "Shamir — How to Share a Secret (1979)",
              url: "https://dl.acm.org/doi/10.1145/359168.359176",
              note: "The original paper on threshold secret sharing",
            },
            {
              label: "Harvest now, decrypt later",
              url: "https://en.wikipedia.org/wiki/Harvest_now,_decrypt_later",
              note: "Why we encrypt every shard with ML-KEM-768 today",
            },
          ]}
        />

        <PillarSection
          icon={ICON_PATHS.historyToggleOff}
          badge="Pillar 5"
          title="Legal-Grade Audit Trail"
          intro="For a court to admit Keeplas as evidence in a succession case, it has to prove who acted, when, and from where — without us being able to forge or rewrite it. Every state-changing action is appended to an immutable, hash-chained log with a server-attested IP and country, and the chain is broken the instant anyone tampers with a single entry."
          bullets={[
            "Every mutation produces an audit entry with action, resource, timestamp, IP, and country.",
            "IP and country are signed server-side with HMAC-SHA256 — clients cannot spoof their own location.",
            "Each entry carries the previous entry's hash, so the chain can be replayed and verified offline.",
            "At signup we collect your date of birth (legal capacity) and country of residence (applicable inheritance law) — both are stored on your user record and recorded in the audit chain.",
            "We preserve audit logs even after account deletion: the immutable trail outlives the user, which is exactly the property a probate court needs.",
          ]}
          technical={{
            title: "How it works (technical)",
            lines: [
              "Middleware · Vercel x-vercel-ip-country + x-forwarded-for → HMAC-SHA256(ip|country|ts, KEEPLAS_CTX_SECRET) → HttpOnly cookie",
              "auditedMutation wrapper · re-verifies HMAC server-side before persisting → rejects forged contexts",
              "audit_logs table · userId, actorType, actorId, action, resourceType, resourceId, ipAddress, country, previousLogHash, logHash, createdAt",
              "Hash chain · logHash[n] = hash(previousLogHash[n] | action | resourceType | resourceId | timestamp)",
              "Cross-user actions (e.g. trusted contact accepts an invitation) are logged on the vault owner's chain with actorType=trusted_contact",
            ],
          }}
          references={[
            {
              label: "RFC 2104 — HMAC",
              url: "https://datatracker.ietf.org/doc/html/rfc2104",
              note: "The construction we use to seal the IP/country envelope",
            },
            {
              label: "EU eIDAS Regulation",
              url: "https://eur-lex.europa.eu/eli/reg/2014/910/oj",
              note: "Framework for legally-recognized electronic records in the EU",
            },
            {
              label: "GDPR",
              url: "https://gdpr-info.eu/",
              note: "We log metadata only (actions, IP, country) — never plaintext content",
            },
            {
              label: "Vercel geolocation headers",
              url: "https://vercel.com/docs/edge-network/headers/request-headers",
              note: "Source of the country/IP we sign — replaceable for self-hosted deployments",
            },
          ]}
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
              answer={
                <>
                  <ExternalLink href="https://www.rfc-editor.org/rfc/rfc9106.html">
                    Argon2id
                  </ExternalLink>{" "}
                  (OWASP 2024 params) for key derivation,{" "}
                  <ExternalLink href="https://csrc.nist.gov/pubs/sp/800/38/d/final">
                    AES-256-GCM
                  </ExternalLink>{" "}
                  for symmetric encryption,{" "}
                  <ExternalLink href="https://csrc.nist.gov/pubs/fips/203/final">
                    ML-KEM-768
                  </ExternalLink>{" "}
                  (NIST FIPS 203, the post-quantum KEM standardized in August
                  2024) for wrapping per-recipient keys,{" "}
                  <ExternalLink href="https://csrc.nist.gov/pubs/fips/180/4/upd1/final">
                    SHA-256
                  </ExternalLink>{" "}
                  for verifiers, and{" "}
                  <ExternalLink href="https://dl.acm.org/doi/10.1145/359168.359176">
                    Shamir Secret Sharing
                  </ExternalLink>{" "}
                  over GF(256) for trusted-contact recovery. Cryptography runs
                  client-side via the{" "}
                  <ExternalLink href="https://www.w3.org/TR/WebCryptoAPI/">
                    Web Crypto API
                  </ExternalLink>{" "}
                  and{" "}
                  <ExternalLink href="https://github.com/paulmillr/noble-post-quantum">
                    @noble/post-quantum
                  </ExternalLink>
                  .
                </>
              }
            />
            <FaqItem
              question="Are you quantum-safe?"
              answer={
                <>
                  Yes, end-to-end. Symmetric primitives (AES-256-GCM, Argon2id,
                  SHA-256, Shamir Secret Sharing) are all quantum-resistant by
                  construction. The asymmetric layer — used to wrap
                  per-recipient keys and trusted-contact shards — uses{" "}
                  <ExternalLink href="https://csrc.nist.gov/pubs/fips/203/final">
                    ML-KEM-768
                  </ExternalLink>
                  , the NIST-standardized post-quantum KEM (FIPS 203, August
                  2024). This blocks the{" "}
                  <ExternalLink href="https://en.wikipedia.org/wiki/Harvest_now,_decrypt_later">
                    harvest-now-decrypt-later
                  </ExternalLink>{" "}
                  threat: data we store today stays opaque even to a future
                  adversary running Shor&apos;s algorithm on a large quantum
                  computer. Most password managers (Bitwarden, 1Password) have
                  not yet migrated; we built Keeplas post-quantum from day one
                  because vault data must stay confidential for decades.
                </>
              }
            />
            <FaqItem
              question="Why do you ask for my date of birth and country?"
              answer="Two legal reasons. Date of birth proves civil capacity (you must be at least 18 to commit your estate) and identifies you in succession proceedings. Country of residence determines which inheritance law applies — French, Belgian, Quebec, and U.S. probate rules differ substantially. Both fields are stored only on your user record and inside the tamper-evident audit chain; they are never used for marketing and never shared with third parties."
            />
            <FaqItem
              question="I was invited as a trusted contact — why are my email and phone already filled in?"
              answer="Because the person who invited you entered them. To add you, they provide your name, email, and optionally your phone number so Keeplas can send you the one-time invitation link and, later, Life Check alerts. When you accept and create your own vault, those identifiers are pre-filled and locked on the signup form so your account matches the identity they registered, which prevents a mismatched email or number. That is the only information shared about you; nothing from their vault is exposed, and you alone hold your 24 words and keys."
            />
            <FaqItem
              question="Will the audit log hold up in court?"
              answer={
                <>
                  That is exactly what it is built for. Every state-changing
                  action is appended to an immutable hash-chained log with a
                  server-attested IP and country (signed via{" "}
                  <ExternalLink href="https://datatracker.ietf.org/doc/html/rfc2104">
                    HMAC-SHA256
                  </ExternalLink>{" "}
                  so a client cannot fake its own location). Auditors and judges
                  can replay the chain offline and detect any tampering:
                  changing a single entry breaks every subsequent hash. Combined
                  with your declared identity (date of birth, country), this is
                  what lets a notary or probate court accept Keeplas activity as
                  evidence of intent and authenticity. The full framework around
                  legally-recognized electronic records in the EU is{" "}
                  <ExternalLink href="https://eur-lex.europa.eu/eli/reg/2014/910/oj">
                    eIDAS
                  </ExternalLink>
                  .
                </>
              }
            />
            <FaqItem
              question="What about GDPR?"
              answer={
                <>
                  Audit entries store action metadata only — never the plaintext
                  of your vault. You can request export or deletion of your
                  account at any time, but the audit chain itself is preserved
                  (anonymized to your now-deleted user ID) so that the
                  immutability guarantee on which a future probate court might
                  rely is not retroactively destroyed. See{" "}
                  <ExternalLink href="https://gdpr-info.eu/">
                    GDPR full text
                  </ExternalLink>{" "}
                  for the legal basis (Article 6.1.f legitimate interest
                  combined with Article 17.3.b legal obligation).
                </>
              }
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
