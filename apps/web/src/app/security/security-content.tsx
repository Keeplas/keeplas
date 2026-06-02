import { Link } from "@/lib/navigation";
import { Icon } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { BackButton } from "./back-button";
import { useDictionary } from "@/lib/i18n";

interface Reference {
  label: string;
  url: string;
  note?: string;
}

// Crypto specs (monospace) and standards citations stay in English on purpose:
// they are technical reference material (RFC/FIPS names, algorithm parameters)
// where English is the canonical form. Only the surrounding narrative is localized.
const PILLARS: Array<{
  key: "auth" | "zk" | "device" | "recovery" | "audit";
  icon: string;
  technicalLines: string[];
  references: Reference[];
}> = [
  {
    key: "auth",
    icon: ICON_PATHS.user,
    technicalLines: [
      "Convex Auth · scrypt password hashing server-side",
      "TOTP · RFC 6238 · 30s window · base32 secret never leaves the backend after enrollment",
      "Reset path · salted Argon2id(phrase) verifier matches users.recoveryPhraseHash (constant-time) → modify scrypt hash",
    ],
    references: [
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
    ],
  },
  {
    key: "zk",
    icon: ICON_PATHS.lock,
    technicalLines: [
      "Phrase → Argon2id(memorySize 19 MiB, iterations 2, parallelism 1, hashLength 32) → RootKey",
      "MasterKey · AES-256-GCM · randomly generated, never shared in cleartext",
      "encryptedKeyBundle · { phraseSalt, iv, encryptedMasterKey }",
      "Recipient encryption · ML-KEM-768 (NIST FIPS 203, August 2024) · KEM-DEM with AES-256-GCM",
      "Vault items · per-item DEK wrapped by MasterKey · all encryption in WebCrypto + @noble/post-quantum client-side",
    ],
    references: [
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
    ],
  },
  {
    key: "device",
    icon: ICON_PATHS.fingerprint,
    technicalLines: [
      "PIN · Argon2id(secret, deviceSalt) → wrapKey → AES-GCM(MasterKey)",
      "Biometric / Hardware key · WebAuthn createCredential with prf:{eval:{first:salt}} extension",
      "PRF output → AES-256-GCM wrapKey → wraps MasterKey · stored in IndexedDB",
      "Lockout · 5 wrong PIN attempts → 60s freeze · 10 → entry wiped, 24-word re-entry required",
    ],
    references: [
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
    ],
  },
  {
    key: "recovery",
    icon: ICON_PATHS.users,
    technicalLines: [
      "Shamir Secret Sharing · 4 shards · threshold 2–3 to reconstruct MasterKey",
      "Shards · 1 local · 3 distributed to trusted contacts (ML-KEM-768 + AES-256-GCM wrapped to each contact's public key) · Keeplas holds NO shard",
      "Recovery phrase verification · SHA-256(phrase) compared server-side · phrase never sent",
      "No master key, no escrow, no employee or court-ordered access path",
    ],
    references: [
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
    ],
  },
  {
    key: "audit",
    icon: ICON_PATHS.historyToggleOff,
    technicalLines: [
      "Middleware · Vercel x-vercel-ip-country + x-forwarded-for → HMAC-SHA256(ip|country|ts, KEEPLAS_CTX_SECRET) → HttpOnly cookie",
      "auditedMutation wrapper · re-verifies HMAC server-side before persisting → rejects forged contexts",
      "audit_logs table · userId, actorType, actorId, action, resourceType, resourceId, ipAddress, country, previousLogHash, logHash, createdAt",
      "Hash chain · logHash[n] = hash(previousLogHash[n] | action | resourceType | resourceId | timestamp)",
      "Cross-user actions (e.g. trusted contact accepts an invitation) are logged on the vault owner's chain with actorType=trusted_contact",
    ],
    references: [
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
    ],
  },
];

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

function ReferenceList({
  items,
  label,
}: {
  items: Reference[];
  label: string;
}) {
  return (
    <div className="border-t border-outline-variant/20 mt-4 pt-4">
      <p className="text-label-md text-on-surface-variant uppercase tracking-widest mb-3">
        {label}
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

interface PillarSectionProps {
  icon: string;
  badge: string;
  title: string;
  intro: string;
  bullets: string[];
  technicalTitle: string;
  technicalLines: string[];
  references: Reference[];
  externalRefsLabel: string;
}

function PillarSection({
  icon,
  badge,
  title,
  intro,
  bullets,
  technicalTitle,
  technicalLines,
  references,
  externalRefsLabel,
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
          <span>{technicalTitle}</span>
          <Icon
            path={ICON_PATHS.chevronRight}
            className="w-4 h-4 text-on-surface-variant transition-transform group-open:rotate-90"
          />
        </summary>
        <div className="px-4 pb-4 space-y-2">
          {technicalLines.map((line) => (
            <p
              key={line}
              className="text-body-md text-on-surface-variant font-mono leading-relaxed"
            >
              {line}
            </p>
          ))}
          {references.length > 0 && (
            <ReferenceList items={references} label={externalRefsLabel} />
          )}
        </div>
      </details>
    </section>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
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

export function SecurityContent() {
  const s = useDictionary().security;
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
              <span className="text-label-md text-primary">{s.badge1}</span>
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full shadow-sm">
              <Icon path={ICON_PATHS.lock} className="w-5 h-5" />
              <span className="text-label-md font-bold">{s.badge2}</span>
            </span>
          </div>
          <h1 className="text-display-md md:text-display-lg text-primary">
            {s.title}
          </h1>
          <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">
            {s.intro}
          </p>
        </header>

        {/* Pillars */}
        {PILLARS.map((p) => {
          const copy = s.pillars[p.key];
          return (
            <PillarSection
              key={p.key}
              icon={p.icon}
              badge={copy.badge}
              title={copy.title}
              intro={copy.intro}
              bullets={copy.bullets}
              technicalTitle={s.technicalTitle}
              technicalLines={p.technicalLines}
              references={p.references}
              externalRefsLabel={s.externalRefs}
            />
          );
        })}

        {/* FAQ */}
        <section className="space-y-4">
          <h2 className="text-headline-md text-primary text-center">
            {s.faqHeading}
          </h2>
          <div className="space-y-3">
            {s.faq.map((item) => (
              <FaqItem key={item.q} question={item.q} answer={item.a} />
            ))}
          </div>
        </section>

        {/* CTA */}
        <footer className="text-center space-y-4 pt-8">
          <p className="text-body-lg text-on-surface-variant">{s.cta.prompt}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="vault-gradient text-white px-8 py-3 rounded-xl font-bold inline-flex items-center justify-center gap-2 shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
            >
              {s.cta.create}
              <Icon path={ICON_PATHS.arrowRight} className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="text-secondary px-8 py-3 font-bold hover:underline"
            >
              {s.cta.have}
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
