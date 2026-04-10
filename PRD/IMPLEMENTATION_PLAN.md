# Keeplas - Implementation Plan & User Stories

> Version: 1.1 | Date: 2026-04-10 | Status: In Development

---

## Progress Summary

| Phase | Status | Completed |
|-------|--------|-----------|
| **Phase 0 — Foundation** | **DONE** | Monorepo, scaffolding, CI, governance, `.env.example` |
| **Phase 1 — Design System + Auth** | **DONE** | Design tokens, ShadCN components, Convex Auth (Google + Password), auth pages (sign-in/sign-up), app shell (sidebar + glass nav), protected routes, dashboard placeholder |
| Phase 2 — Crypto Core + Onboarding | Pending | — |
| Phase 3 — Vault Core | Pending | — |
| Phase 4 — Emergency Card | Pending | — |
| Phase 5 — Trusted Contacts | Pending | — |
| Phase 6 — Life Check MVP | Pending | — |
| Phase 7 — Polish + Beta Launch | Pending | — |

---

## Table of Contents

1. [MVP Scope](#1-mvp-scope)
2. [Phase 0 - Foundation](#2-phase-0---foundation-weeks-1-2)
3. [Phase 1 - Design System + Auth](#3-phase-1---design-system--auth-weeks-3-5)
4. [Phase 2 - Crypto Core + Onboarding](#4-phase-2---crypto-core--onboarding-weeks-6-8)
5. [Phase 3 - Vault Core](#5-phase-3---vault-core-weeks-9-11)
6. [Phase 4 - Emergency Card](#6-phase-4---emergency-card-weeks-12-13)
7. [Phase 5 - Trusted Contacts](#7-phase-5---trusted-contacts-weeks-14-17)
8. [Phase 6 - Life Check MVP](#8-phase-6---life-check-mvp-weeks-18-20)
9. [Phase 7 - Polish + Beta Launch](#9-phase-7---polish--beta-launch-weeks-21-23)
10. [Post-MVP Roadmap](#10-post-mvp-roadmap)
11. [Dependency Graph](#11-dependency-graph)
12. [Sprint Calendar](#12-sprint-calendar)
13. [Risk Factors](#13-risk-factors)

---

## 1. MVP Scope

### Included in MVP (Beta Launch at $49 Lifetime Deal)

- Monorepo + dev environment
- Design system (core components - "The Digital Curator")
- Authentication (Passkey + Google OAuth + Email/password)
- Onboarding (Recovery Phrase 24 BIP-39 words, verification, Master Key)
- Vault (encrypted CRUD, 9 categories, Vault Integrity Score)
- Emergency Card (creation, privacy toggles, QR code, print)
- Trusted Contacts (invitation, shard distribution, Mode A post-mortem, Mode B1 on-demand)
- Life Check basic (push + email channels, no passive signals)
- Dashboard (Vault Integrity Score widget, priority actions)
- Audit logging (immutable chain)
- In-app notifications (real-time)
- i18n (French + English)
- Landing page + Stripe payment

### Deferred to Post-MVP

- Life Map with React Flow central node visualization
- AI Assistant (chat, completeness analyzer, Family Guide PDF)
- Passive signals scoring for Life Check
- IVR calls, WhatsApp channel integration
- Modes B2 (permanent), B3 (medical), B4 (conditional)
- Conditional Messages
- Legal Legacy / Entrepreneur Portal
- Scenarios engine
- Docker Compose self-hosting
- PWA support
- Social Recovery (2 contacts submit shards)
- ZK Proofs with Noir/Barretenberg (placeholder encryption for shard 5 in MVP)

---

## 2. Phase 0 - Foundation (Weeks 1-2) — DONE

**Goal:** Bootable monorepo, all tooling works, CI runs green.

### Tasks

| # | Task | Details | Status |
|---|------|---------|--------|
| 0.1 | Init Turborepo + pnpm workspace | `pnpm-workspace.yaml`, `turbo.json`, root `package.json`, `.npmrc` | **DONE** |
| 0.2 | Scaffold `apps/web` | Next.js 16 App Router, TypeScript strict, Tailwind v4 | **DONE** |
| 0.3 | Scaffold `packages/convex` | Convex project init, `schema.ts` (14 tables + authTables), deployed to Convex Cloud | **DONE** |
| 0.4 | Scaffold `packages/crypto` | Package structure: `aes/`, `shamir/`, `recovery/`, `zk/` with TS config, stub implementations | **DONE** |
| 0.5 | Scaffold `packages/ui` | ShadCN-style components: Button, Card, Input, Badge, Switch, Progress, Avatar, Label, Separator, DropdownMenu, LegacyCard | **DONE** |
| 0.6 | CI pipeline | GitHub Actions `ci.yml`: lint, typecheck, test, pnpm audit | **DONE** |
| 0.7 | Governance files | CODEOWNERS, CONTRIBUTING.md, CLA.md, SECURITY.md, CODE_OF_CONDUCT.md, issue templates, PR template | **DONE** |
| 0.8 | Dev environment | `.env.example` with all documented vars, `.gitignore` | **DONE** |

### Monorepo Structure to Create

```
keeplas-app/
├── apps/
│   └── web/                        # Next.js App Router
│       ├── app/                    # Pages (App Router)
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   └── globals.css
│       ├── components/             # App-specific components
│       ├── lib/                    # Utilities
│       ├── public/
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   ├── crypto/                     # RESTRICTED - Founders only
│   │   ├── src/
│   │   │   ├── aes/
│   │   │   │   ├── masterKey.ts
│   │   │   │   ├── encrypt.ts
│   │   │   │   ├── decrypt.ts
│   │   │   │   └── index.ts
│   │   │   ├── shamir/
│   │   │   │   ├── split.ts
│   │   │   │   ├── reconstruct.ts
│   │   │   │   ├── encryptShards.ts
│   │   │   │   └── index.ts
│   │   │   ├── recovery/
│   │   │   │   ├── bip39.ts
│   │   │   │   └── index.ts
│   │   │   ├── zk/                 # Post-MVP placeholder
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── convex/                     # Convex schema + functions
│   │   ├── schema.ts
│   │   ├── users.ts
│   │   ├── vaults.ts
│   │   ├── vault_items.ts
│   │   ├── trusted_contacts.ts
│   │   ├── life_check.ts
│   │   ├── emergency_cards.ts
│   │   ├── access_requests.ts
│   │   ├── audit_logs.ts
│   │   ├── notifications.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── ui/                         # Shared ShadCN components
│       ├── src/
│       │   ├── button.tsx
│       │   ├── card.tsx
│       │   ├── input.tsx
│       │   ├── badge.tsx
│       │   ├── switch.tsx
│       │   ├── progress.tsx
│       │   ├── table.tsx
│       │   ├── dropdown-menu.tsx
│       │   ├── legacy-card.tsx
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
├── scripts/
│   ├── install.sh
│   ├── setup-dev.sh
│   ├── setup-convex.sh
│   └── health-check.sh
├── .github/
│   ├── CODEOWNERS
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── security.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── security_vulnerability.md
│   └── PULL_REQUEST_TEMPLATE.md
├── .env.example
├── docker-compose.dev.yml
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── LICENSE
├── CLA.md
├── CONTRIBUTING.md
├── SECURITY.md
├── CODE_OF_CONDUCT.md
└── .gitignore
```

### User Stories

**E1-S1: Developer Environment Setup**
> As a developer, I want to clone the repo and run `pnpm install && pnpm dev` so that I have a working development environment in under 5 minutes.

Acceptance Criteria:
- [x] `pnpm dev` starts Next.js on localhost:3000 connected to Convex dev backend
- [x] TypeScript compilation passes with zero errors
- [x] ESLint runs with no warnings on clean checkout
- [x] All workspace packages resolve correctly

**E1-S2: Code Ownership Protection** — DONE
> As a founder, I want CODEOWNERS to protect `packages/crypto/` and `security/` so that only Prince and Ghislain can approve changes to sensitive code.

Acceptance Criteria:
- [x] PRs touching `packages/crypto/**` require approval from both `@prince-keeplas` and `@ghislain-keeplas`
- [x] PRs touching `security/**` require founder approval
- [x] All other areas are open to community contributors

**E1-S3: CI Pipeline** — DONE
> As a developer, I want a CI pipeline that runs lint, typecheck, tests, and security audit on every PR so that code quality is maintained.

Acceptance Criteria:
- [x] GitHub Actions workflow runs on every PR
- [x] Pipeline runs: ESLint, TypeScript typecheck, Vitest, pnpm audit
- [ ] Pipeline fails on lint errors, type errors, test failures, or critical audit findings
- [ ] Status checks required before merge

### Milestone Verification
```bash
git clone <repo>
cd keeplas-app
pnpm install        # All packages install successfully
pnpm dev            # Next.js boots on :3000, Convex dev connected
pnpm lint           # No errors
pnpm typecheck      # No errors
pnpm build          # Build succeeds
```

---

## 3. Phase 1 - Design System + Auth (Weeks 3-5) — DONE

**Goal:** "The Digital Curator" visual identity applied, authentication working end-to-end.

### Sprint 1A: Design System (Week 3-4) — DONE

#### Tasks

| # | Task | Details | Status |
|---|------|---------|--------|
| 1.1 | Tailwind color tokens | Full palette from `PRD/Design/design-guidelines.md` wireframes — all 40+ tokens in `globals.css` `@theme inline` | **DONE** |
| 1.2 | Typography setup | Manrope (`font-headline`) + Inter (`font-body`, `font-label`) via `next/font` | **DONE** |
| 1.3 | Typography scale | CSS utility classes: `text-display-lg/md`, `text-headline-lg/md`, `text-body-lg/md`, `text-label-lg/md` | **DONE** |
| 1.4 | Theme ShadCN Button | `vault-gradient` (135deg), `active:scale-95`, `hover:scale-[1.02]`, sizes sm/md/lg/icon | **DONE** |
| 1.5 | Theme ShadCN Card | No borders, `rounded-full` (0.75rem), `bg-surface-container-low` | **DONE** |
| 1.6 | Theme ShadCN Input | `bg-surface-container-low border-none rounded-xl`, `focus:bg-surface-container-high focus:ring-secondary/20` | **DONE** |
| 1.7 | Theme ShadCN Badge | `bg-secondary-container text-on-secondary-container rounded-lg` | **DONE** |
| 1.8 | Theme ShadCN Switch | `bg-secondary` active, `bg-surface-container-highest` inactive | **DONE** |
| 1.9 | Theme ShadCN Progress | `gradient-signature` fill bar | **DONE** |
| 1.10 | Theme ShadCN Table | Not yet implemented | Pending |
| 1.11 | Theme ShadCN DropdownMenu | `glass-light` glassmorphism, `animate-slide-down` | **DONE** |
| 1.12 | Glassmorphism mixin | `.glass` (primary 85%), `.glass-light` (surface 80%), `.ghost-border` (outline-variant 15%) | **DONE** |
| 1.13 | App shell layout | Glass top nav + sidebar (desktop) + bottom nav (mobile), logo, avatar dropdown | **DONE** |
| 1.14 | Legacy Card component | `bg-primary-container text-on-primary-container rounded-full` | **DONE** |
| 1.15 | No-border rule | All components use tonal layering, only `.ghost-border` allowed (outline-variant at 15%) | **DONE** |

#### Design Tokens Reference (corrected from PRD/Design/wireframes)

```css
/* Implemented in apps/web/src/app/globals.css @theme inline */
/* Colors match PRD/Design/design-guidelines.md exactly */
primary: #041632          /* Vault Navy */
primary-container: #1b2b48  /* NOT #28657a — corrected from wireframes */
secondary: #28657a        /* Reassurance Teal */
secondary-fixed: #b9eaff
surface: #fcf9f8          /* NOT #f6f3f2 — corrected from wireframes */
surface-container: #f0eded
outline-variant: #c5c6ce  /* NOT #cdc8c5 — corrected from wireframes */
on-primary-container: #8393b5

/* Border radius — architectural subtle scale */
DEFAULT: 0.125rem, lg: 0.25rem, xl: 0.5rem, full: 0.75rem
```

#### User Stories

**E2-S1: Color Token Configuration** — DONE
> As a developer, I want the Tailwind configuration to include all color tokens from the design spec so that I can use semantic names like `bg-surface-container-low`.

Acceptance Criteria:
- [x] All 40+ color tokens from `PRD/Design/design-guidelines.md` wireframes are in `globals.css` `@theme inline`
- [x] Fonts Manrope and Inter are loaded via `next/font`
- [x] Border radius scale matches wireframe spec (`DEFAULT: 0.125rem, lg: 0.25rem, xl: 0.5rem, full: 0.75rem`)

**E2-S2: No-Border Editorial Aesthetic** — DONE
> As a user, I want the interface to feel like a premium editorial experience with tonal depth so that the product feels authoritative and trustworthy.

Acceptance Criteria:
- [x] No component uses `border` or `border-1` for visual sectioning
- [x] All hierarchy is achieved via background color shifts between surface tiers
- [x] Cards use `surface-container-low` on `surface` background (no borders)
- [x] Only `.ghost-border` (outline-variant at 15% opacity) allowed when needed

**E2-S3: ShadCN Component Library** — DONE
> As a developer, I want themed ShadCN components so that I can build features with consistent styling.

Acceptance Criteria:
- [x] Button: `vault-gradient` (135deg), secondary = text-only, destructive = error
- [x] Card: no borders, tonal shift `rounded-full` (0.75rem)
- [x] Input: `bg-surface-container-low border-none`, focus transitions to `surface-container-high`
- [x] All 12 components in `packages/ui/` render correctly with Keeplas theme

**E2-S4: App Shell with Glass Navigation** — DONE
> As a user, I want the app shell with glass navigation bar and sidebar so that I can navigate between sections.

Acceptance Criteria:
- [x] Glass nav: `.glass` class (primary 85% + backdrop-blur 20px)
- [x] Active link uses `bg-secondary-container text-on-secondary-container`
- [x] Sidebar with navigation links: Dashboard, Vault, Trusted Contacts, Life Check, Emergency Card
- [x] Responsive: sidebar collapses to bottom nav on mobile (<768px)
- [x] User avatar initial + dropdown with sign-out in top-right

**E2-S5: Legacy Card Component** — DONE
> As a developer, I want a Legacy Card component for highlighting vital pinned information.

Acceptance Criteria:
- [x] Uses `primary-container` background, `on-primary-container` text
- [x] Distinct from regular Card — acts as visual anchor for critical data
- [x] Reusable across dashboard and vault views

---

### Sprint 1B: Authentication (Week 4-5) — DONE (Google + Password)

#### Tasks

| # | Task | Details | Status |
|---|------|---------|--------|
| 1.16 | Convex Auth setup | `@convex-dev/auth` + `ConvexAuthProvider`, `auth.ts`, `http.ts`, `auth.config.ts` | **DONE** |
| 1.17 | Passkey (WebAuthn) | Registration + Login with platform authenticator | Pending (Phase 2) |
| 1.18 | Google OAuth | Google provider configured in Convex Auth | **DONE** |
| 1.19 | Apple OAuth | Apple provider | Pending (post-MVP) |
| 1.20 | Email + password | `Password` provider with min 8 chars, confirm password | **DONE** |
| 1.21 | Sign Up page | "Create your sanctuary" — editorial split-screen matching `wireframes-1.md` signup wireframe | **DONE** |
| 1.22 | Sign In page | "Welcome back, Curator" — editorial split-screen matching `wireframes-1.md` login wireframe | **DONE** |
| 1.23 | Session management | `ConvexAuthProvider`, `useConvexAuth()`, protected route redirect in dashboard layout | **DONE** |
| 1.24 | Auth layout | Split-screen: vault-gradient branding (desktop) + form (right), mobile logo, decorative blurs | **DONE** |

#### User Stories

**E3-S1: Passkey Registration** — Deferred to Phase 2
> As a new user, I want to create my account using Passkey (Face ID / fingerprint) as the recommended method so that my authentication is maximally secure with zero friction.

Acceptance Criteria:
- [ ] Sign-up page shows Passkey option first with "Recommended" badge
- [ ] Triggers WebAuthn `navigator.credentials.create()` with platform authenticator
- [ ] On success, user record created in Convex with `authProviders: ["passkey"]`
- [ ] `passkeyCredentials` array populated with credential ID + public key
- [ ] Works on Chrome, Safari, Firefox (desktop + mobile)

**E3-S2: Google OAuth** — DONE
> As a new user, I want to sign up with Google OAuth so that I can use my existing Google account.

Acceptance Criteria:
- [x] Google OAuth button present on sign-up and sign-in pages
- [x] On success, Convex Auth session established
- [ ] Profile info (name, email, avatar) pulled from Google — requires Google Console setup

**E3-S3: Email + Password Fallback** — DONE
> As a new user, I want to sign up with email and password as a fallback so that I can register even without Passkey or OAuth support.

Acceptance Criteria:
- [x] Email/password form with Full Name, Email, Password, Confirm Password
- [x] Password must meet minimum strength (8+ chars)
- [x] User created via Convex Auth `Password` provider
- [ ] Email verification — not yet configured

**E3-S4: Passkey Login** — Deferred to Phase 2
> As a returning user, I want to sign in with my Passkey so that I can access my vault with biometrics only.

Acceptance Criteria:
- [ ] Sign-in triggers WebAuthn `navigator.credentials.get()`
- [ ] On successful assertion, session established
- [ ] `lastSeenAt` updated on user record
- [ ] Redirect to dashboard (or onboarding if incomplete)

**E3-S5: Multi-Device Passkey Management** — Deferred to Phase 2
> Deferred — depends on Passkey implementation.

**E3-S6: Device Revocation** — Deferred to Phase 2
> Deferred — depends on Passkey implementation.

### Milestone Verification
```
1. Open localhost:3000 → redirects to /sign-in                     DONE
2. See editorial sign-in page matching wireframe                   DONE
3. Create account with email/password → redirect to dashboard      DONE
4. See dashboard with glass nav + sidebar                          DONE
5. Sign out via avatar dropdown → redirect to sign-in              DONE
6. Sign up page with editorial branding + Legacy Card preview      DONE
7. Responsive: sidebar collapses to bottom nav on mobile           DONE
8. Create account with Google OAuth                                DONE (needs Google Console config)
9. Create account with Passkey                                     PENDING (Phase 2)
```

---

## 4. Phase 2 - Crypto Core + Onboarding (Weeks 6-8)

**Goal:** Master Key generation, Recovery Phrase, vault encryption operational client-side.

### Sprint 2A: packages/crypto Core (Week 6-7) -- FOUNDERS ONLY

#### Tasks

| # | Task | Details |
|---|------|---------|
| 2.1 | AES Master Key generation | `masterKey.ts`: Generate 256-bit AES-GCM key via `crypto.subtle.generateKey()` |
| 2.2 | AES encrypt | `encrypt.ts`: `encrypt(plaintext, key) → { ciphertext, iv, tag }` using AES-256-GCM |
| 2.3 | AES decrypt | `decrypt.ts`: `decrypt(ciphertext, key, iv) → plaintext` |
| 2.4 | BIP-39 phrase generation | `bip39.ts`: Generate 24-word phrase from wordlist, derive key from phrase |
| 2.5 | BIP-39 phrase verification | Verify subset of words matches, compute SHA-256 hash for server storage |
| 2.6 | Shamir split | `split.ts`: Split 256-bit secret into 5 shares with threshold 3 |
| 2.7 | Shamir reconstruct | `reconstruct.ts`: Reconstruct secret from any 3+ shares |
| 2.8 | Shard encryption | `encryptShards.ts`: Encrypt each shard with recipient's public key (ECDH + AES) |
| 2.9 | Key bundle encryption | Encrypt Master Key with Passkey credential for device storage |
| 2.10 | Unit tests | Exhaustive tests: encrypt→decrypt roundtrip, split→reconstruct, edge cases, different key sizes |

#### Crypto Architecture (Zero-Knowledge Rules)

```
CLIENT ONLY (never transmitted):          CONVEX STORES (safe):
─────────────────────────────            ─────────────────────
Master Key (256-bit)                      encryptedKeyBundle (AES-wrapped)
Recovery Phrase (24 words)                recoveryPhraseHash (SHA-256)
Shamir Shards (plaintext)                 Shards encrypted with contact public keys
Vault decryption                          Vault items AES-256-GCM encrypted
ZK Proof computation                      ZK Proof verification result
                                          Public keys
                                          Metadata (titles, dates)
                                          Audit logs (immutable)
```

#### User Stories

**E4-CRYPTO-1: Master Key Generation**
> As the crypto package, I must generate a cryptographically secure 256-bit AES-GCM key entirely client-side so that no server ever sees the raw key.

Acceptance Criteria:
- [ ] Uses `crypto.subtle.generateKey("AES-GCM", 256, true)`
- [ ] Key is extractable for Shamir splitting
- [ ] Key never appears in any network request (verify with DevTools)
- [ ] Works in all modern browsers (Chrome 90+, Safari 15+, Firefox 90+)

**E4-CRYPTO-2: AES-256-GCM Encryption/Decryption**
> As the crypto package, I must encrypt and decrypt arbitrary data with AES-256-GCM so that vault items are protected at rest.

Acceptance Criteria:
- [ ] `encrypt(plaintext, key)` returns `{ ciphertext: ArrayBuffer, iv: Uint8Array }`
- [ ] `decrypt(ciphertext, key, iv)` returns original plaintext
- [ ] IV is randomly generated per encryption (never reused)
- [ ] Roundtrip test: encrypt → decrypt === original for text, JSON, binary data
- [ ] Fails gracefully with wrong key (throws, doesn't return garbage)

**E4-CRYPTO-3: BIP-39 Recovery Phrase**
> As the crypto package, I must generate a 24-word BIP-39 recovery phrase and derive a Master Key from it so that users have a backup recovery method.

Acceptance Criteria:
- [ ] Uses standard BIP-39 English wordlist (2048 words)
- [ ] 256-bit entropy → 24 words with checksum
- [ ] `phraseToKey(words[]) → CryptoKey` deterministically derives same key
- [ ] `phraseToHash(words[]) → string` produces SHA-256 hash for server verification
- [ ] Same phrase always produces same key and same hash

**E4-CRYPTO-4: Shamir Secret Sharing**
> As the crypto package, I must split a 256-bit secret into 5 shares where any 3 can reconstruct it so that no single point of failure exists.

Acceptance Criteria:
- [ ] `split(secret, 5, 3)` returns 5 distinct shares
- [ ] Any combination of 3 shares reconstructs the original secret
- [ ] Any combination of 2 shares reveals zero information about the secret
- [ ] Shares are distinct (no two are identical)
- [ ] Test all 10 possible 3-of-5 combinations

---

### Sprint 2B: Onboarding Flow (Week 7-8)

#### Tasks

| # | Task | Details |
|---|------|---------|
| 2.11 | Recovery Phrase display | 3-column grid of 24 numbered words, copy button, print button |
| 2.12 | "I saved my words" confirmation | Checkbox + continue button |
| 2.13 | 3-word verification screen | 3 randomly chosen indices, input fields, validate against phrase |
| 2.14 | Master Key generation trigger | After verification: generate key, split, encrypt bundle, store |
| 2.15 | Store encryptedKeyBundle | Convex mutation: store encrypted key bundle for user |
| 2.16 | Store recoveryPhraseHash | Convex mutation: store SHA-256 hash only (never the phrase) |
| 2.17 | Shard 1 local storage | Encrypt shard with device biometrics, store in IndexedDB/localStorage |
| 2.18 | Shard 5 Keeplas shard | Encrypt for Keeplas (simple RSA/AES for MVP, ZK post-MVP) |
| 2.19 | Onboarding state machine | `onboardingStep` enum: `auth_complete → recovery_phrase → verification → key_generation → complete` |
| 2.20 | Recovery flow | Enter 24 words → verify hash → reconstruct Master Key → create new Passkey |
| 2.21 | Vocabulary mapping | All UI text uses friendly terms (see table below) |

#### Vocabulary Mapping (No Technical Jargon)

| Technical Term | User-Facing Term (EN) | User-Facing Term (FR) |
|---------------|----------------------|----------------------|
| Master Key | Secret Key | Cle secrete personnelle |
| Shard | Recovery fragment | Fragment de recuperation |
| Shamir 3-of-5 | 3 of 5 contacts required | 3 contacts sur 5 requis |
| Recovery Phrase | Recovery Words / Backup Words | Mots de recuperation |
| Zero-Knowledge | Private & secure | Prive et securise |
| Encryption | Protection | Protection |
| Decryption | Unlock | Deverrouiller |
| encryptedKeyBundle | Secured key | Cle securisee |

#### User Stories

**E4-S1: Recovery Phrase Display**
> As a new user, I want to see my 24 Recovery Words after registration so that I have a backup to recover my vault if I lose all devices.

Acceptance Criteria:
- [ ] After auth, user sees Recovery Phrase screen
- [ ] 24 BIP-39 words displayed in a 3-column, 8-row numbered grid
- [ ] "Copy all" button copies words as text
- [ ] "Print" button opens print dialog with word grid
- [ ] Warning: "Write these words on paper. Never photograph them. Never share them."
- [ ] Words generated entirely client-side (no network call for generation)
- [ ] `onboardingStep` is `recovery_phrase`

**E4-S2: 3-Word Verification**
> As a new user, I want to verify 3 random words from my Recovery Phrase so that the system confirms I actually saved them.

Acceptance Criteria:
- [ ] After clicking "I saved my words", user sees 3 input fields
- [ ] Each field shows the word index (e.g., "Word #7", "Word #14", "Word #21")
- [ ] Indices are randomly chosen, different each time
- [ ] All 3 must match exactly (case-insensitive) to proceed
- [ ] On success: `recoveryPhraseHash` stored in Convex, `recoveryVerified: true`
- [ ] On failure: show error, allow retry (phrase stays in memory)

**E4-S3: Master Key Setup**
> As a new user, I want my Secret Key generated and secured after verification so that my vault is ready.

Acceptance Criteria:
- [ ] After verification, Master Key generated via Web Crypto API
- [ ] Key encrypted with Passkey credential → `encryptedKeyBundle`
- [ ] Bundle stored in Convex via mutation
- [ ] Shamir split into 5 shards:
  - Shard 1 → encrypted locally (IndexedDB)
  - Shard 5 → encrypted for Keeplas
  - Shards 2-4 → pending (assigned when contacts are added)
- [ ] Master Key held in memory only (cleared on sign-out)
- [ ] `onboardingStep` advances to `complete`

**E4-S4: Account Recovery via Phrase**
> As a user who lost access, I want to recover using my 24 Recovery Words so that I can regain access to my vault.

Acceptance Criteria:
- [ ] Recovery page accepts 24 words in grid input
- [ ] Client computes hash, verifies against `recoveryPhraseHash` in Convex
- [ ] On match: Master Key reconstructed from BIP-39 derivation
- [ ] New Passkey created on new device
- [ ] New `encryptedKeyBundle` stored
- [ ] Vault accessible again
- [ ] On mismatch: clear error message, allow retry

**E4-S5: No Technical Jargon**
> As a user, I must never see technical terms like "shard", "ZK", or "Shamir" in the interface.

Acceptance Criteria:
- [ ] All UI text uses vocabulary mapping table above
- [ ] Tooltips explain concepts in plain language
- [ ] Error messages use friendly language
- [ ] No technical term appears in any user-visible string

### Milestone Verification
```
1. Sign up (new user) → see 24 Recovery Words in grid
2. Click "I saved my words" → verify 3 random words
3. Enter all 3 correctly → Master Key generated (loading indicator)
4. Redirected to dashboard → vault ready (0% integrity score)
5. Sign out → Sign in → vault accessible (key decrypted from bundle)
6. Test recovery: new browser → enter 24 words → vault accessible
7. Verify in Convex dashboard: encryptedKeyBundle present, recoveryPhraseHash present, NO plaintext key
```

---

## 5. Phase 3 - Vault Core (Weeks 9-11)

**Goal:** Users can add, view, edit, delete encrypted vault items across all categories.

### Sprint 3A: Vault CRUD (Week 9-10)

#### Tasks

| # | Task | Details |
|---|------|---------|
| 3.1 | Convex vault mutations | `createItem`, `updateItem`, `deleteItem` (soft delete → archived) |
| 3.2 | Convex vault queries | `getItems`, `getItemsByCategory`, `getItem` (single) |
| 3.3 | Client encrypt hook | `useEncryptedMutation()`: encrypts content before calling mutation |
| 3.4 | Client decrypt hook | `useDecryptedQuery()`: decrypts content after receiving query results |
| 3.5 | Vault item form | Title, description, category selector, content area, file upload |
| 3.6 | Category-specific fields | Different form fields per category (see table below) |
| 3.7 | File upload (encrypted) | Encrypt file client-side → upload to Convex `_storage` → store `fileStorageId` |
| 3.8 | Vault list view | Category tabs/filter sidebar, item cards, search |
| 3.9 | Vault item detail view | Decrypted content display, edit/delete actions |
| 3.10 | Tags system | Add/remove tags on items, filter by tag |
| 3.11 | Critical flag | Toggle "Mark as critical" → `isCritical: true`, distinct styling |

#### Vault Categories and Fields

| Category | Specific Fields |
|----------|----------------|
| Personal Documents | Document type, issuing authority, issue date, expiry date, document number |
| Financial Assets | Institution, account type, account number (encrypted), balance hint, beneficiary |
| Digital Assets | Platform, account identifier, access method, 2FA info (encrypted) |
| Health Directives | Directive type, physician, effective date, conditions, DNR status |
| Legal Documents | Document type, attorney, jurisdiction, execution date, witnesses |
| Business Continuity | Business name, role, successor, SOP reference |
| Conditional Messages | Recipient, trigger condition, message content (encrypted) |
| Personal Messages | Recipient, delivery condition, message content (encrypted) |
| Credentials | Service name, username, password (encrypted), URL, notes |

#### User Stories

**E5-S1: Add Encrypted Vault Item**
> As a user, I want to add an item to my vault so that my important information is securely stored.

Acceptance Criteria:
- [ ] "Add item" button opens form with: title, description, category, content, file upload
- [ ] Content encrypted client-side with AES-256-GCM using Master Key before Convex mutation
- [ ] `contentHash` (SHA-256 of plaintext) computed for integrity verification
- [ ] Encrypted blob stored in `vault_items` table
- [ ] On retrieval, content decrypted client-side and displayed
- [ ] Verify in Convex dashboard: `encryptedContent` is unreadable ciphertext

**E5-S2: Category Organization**
> As a user, I want to organize vault items into categories so that I can find information quickly.

Acceptance Criteria:
- [ ] Category selector dropdown with 9 categories + icons
- [ ] Vault list view: tabs or sidebar filter for each category
- [ ] Category counts shown (e.g., "Financial Assets (3)")
- [ ] "All" tab shows all items
- [ ] Empty category shows helpful prompt (e.g., "No health directives yet. Add your first.")

**E5-S3: Edit Vault Item**
> As a user, I want to edit an existing vault item so that I can keep my information up to date.

Acceptance Criteria:
- [ ] "Edit" button on item detail page
- [ ] Content decrypted into form fields
- [ ] On save: content re-encrypted, mutation updates item
- [ ] `updatedAt` timestamp updated
- [ ] Old `contentHash` replaced with new one
- [ ] Audit log entry: `vault_item_updated`

**E5-S4: Delete Vault Item**
> As a user, I want to delete a vault item so that I can remove outdated information.

Acceptance Criteria:
- [ ] "Delete" action with confirmation dialog: "This item will be archived. Are you sure?"
- [ ] Item status set to `archived` (soft delete, not hard delete)
- [ ] Item removed from active list view
- [ ] Audit log entry: `vault_item_archived`

**E5-S5: Encrypted File Upload**
> As a user, I want to upload files (PDF, images) to my vault items so that I can store scanned documents securely.

Acceptance Criteria:
- [ ] File input on vault item form (drag & drop + click)
- [ ] Accepted types: PDF, PNG, JPG, JPEG, WEBP
- [ ] File encrypted client-side before upload to Convex `_storage`
- [ ] `fileStorageId`, `fileType`, `fileSize` stored on vault item
- [ ] File decrypted on download/preview
- [ ] Maximum file size: 10MB per file
- [ ] Progress indicator during upload

**E5-S7: Critical Items**
> As a user, I want to mark vault items as critical so that they are prioritized during emergency access.

Acceptance Criteria:
- [ ] Toggle "Mark as critical" on item form and detail view
- [ ] Critical items displayed with Legacy Card styling
- [ ] `isCritical: true` flag in database
- [ ] Critical items appear first in list views and emergency access

**E5-S8: Access Level Control**
> As a user, I want to set access levels on vault items so that I control who sees what.

Acceptance Criteria:
- [ ] Access level selector: `private` (default), `trusted_only`, `emergency_only`, `public`
- [ ] `private`: only vault owner can see
- [ ] `trusted_only`: visible to contacts with active approved access
- [ ] `emergency_only`: visible only during Mode A (post-mortem)
- [ ] `public`: visible on emergency card (if applicable)

---

### Sprint 3B: Vault Integrity Score + Dashboard (Week 10-11)

#### Tasks

| # | Task | Details |
|---|------|---------|
| 3.12 | Score calculation algorithm | Weighted: categories populated (40%), contacts confirmed (30%), Life Check configured (20%), emergency card created (10%) |
| 3.13 | Score widget | Circular progress or bar with percentage, contextual message |
| 3.14 | Priority actions list | Dynamic list based on missing elements |
| 3.15 | Dashboard page | Score widget, category summary cards, priority actions, recent items |
| 3.16 | Persistent banner | "Vault not protected" warning when no confirmed contacts |
| 3.17 | Nudge messages | Threshold messages at 0%, 25%, 55%, 70%, 88%, 97% |
| 3.18 | Audit log utility | `createAuditLog(action, resourceType, resourceId, metadata)` utility for all mutations |

#### Vault Integrity Score Algorithm

```typescript
function calculateVaultIntegrityScore(data: {
  categoriesPopulated: number;  // out of 9
  totalItems: number;
  confirmedContacts: number;    // out of 5
  lifeCheckConfigured: boolean;
  emergencyCardCreated: boolean;
}): number {
  const categoryScore = Math.min(data.categoriesPopulated / 5, 1) * 40;  // 5+ categories = max
  const contactScore = Math.min(data.confirmedContacts / 3, 1) * 30;     // 3+ contacts = max
  const lifeCheckScore = data.lifeCheckConfigured ? 20 : 0;
  const emergencyScore = data.emergencyCardCreated ? 10 : 0;
  return Math.round(categoryScore + contactScore + lifeCheckScore + emergencyScore);
}
```

#### Nudge Messages

| Score | Message (EN) | Message (FR) |
|-------|-------------|-------------|
| 0% | "Your vault is empty. Start by adding a document." | "Votre vault est vide. Commencez par ajouter un document." |
| 25% | "Good start! Add health directives next." | "Bon debut ! Ajoutez vos directives de sante." |
| 55% | "Halfway there. Invite trusted contacts for emergency access." | "A mi-chemin. Invitez des contacts de confiance." |
| 70% | "Almost secure. Configure Life Check for complete protection." | "Presque securise. Configurez le Life Check." |
| 88% | "Strong protection! Add digital assets for premium recovery." | "Protection solide ! Ajoutez vos actifs numeriques." |
| 97% | "Near perfect! Simulate an emergency to test your workflow." | "Quasi parfait ! Simulez une urgence pour tester." |

#### User Stories

**E5-S6: Vault Integrity Score**
> As a user, I want to see my Vault Integrity Score on the dashboard so that I know how complete my protection is.

Acceptance Criteria:
- [ ] Score displayed as percentage (0-100%) with circular/bar progress
- [ ] Contextual message based on score threshold (see table above)
- [ ] Score updates in real-time as user adds items, contacts, configures features
- [ ] Calculation: categories (40%) + contacts (30%) + Life Check (20%) + emergency card (10%)

**E5-DASH-1: Dashboard Landing Page**
> As a user, I want a dashboard that shows my protection status and guides me to next steps.

Acceptance Criteria:
- [ ] Vault Integrity Score widget (prominent, top of page)
- [ ] Priority Actions list (dynamic, based on what's missing)
- [ ] Category summary cards (count per category, last updated)
- [ ] Recent vault items (3 most recent)
- [ ] Life Check widget placeholder (configured in Phase 6)
- [ ] No forced tutorial — discovery through Score + actions

**E5-DASH-2: Persistent Protection Banner**
> As a user without trusted contacts, I want a persistent banner warning me that my vault is unprotected.

Acceptance Criteria:
- [ ] Banner appears when `confirmedContacts === 0`
- [ ] Text: "Vault not protected in emergency. Without a trusted contact, no one can access your vault."
- [ ] Two buttons: [Invite now] and [Remind in 48h]
- [ ] "Remind in 48h" dismisses banner for 48 hours (stored in Convex)
- [ ] After 48h without action: banner becomes more urgent (error red accent)
- [ ] Banner disappears when first contact is confirmed

### Milestone Verification
```
1. Navigate to Vault → see empty state with category tabs
2. Click "Add item" → fill form → save → verify encryption in Convex dashboard
3. View item → content decrypted and readable
4. Edit item → save → verify updated encryption
5. Delete item → confirm → item archived
6. Upload PDF → verify encrypted in storage
7. Dashboard shows 0% score → add items → score increases
8. Banner "Vault not protected" visible → dismiss → returns after 48h
```

---

## 6. Phase 4 - Emergency Card (Weeks 12-13)

**Goal:** Public emergency ID card, accessible by first responders without authentication.

> Note: This phase can be built in parallel with Phase 3 (Vault) since it has no dependency on encryption for its core function.

### Tasks

| # | Task | Details |
|---|------|---------|
| 4.1 | Emergency card form | Fields: full name, blood type, allergies, medical conditions, medications, emergency contact (name + phone), additional notes |
| 4.2 | Privacy toggles | ShadCN Switch for each field: `showFullName`, `showBloodType`, `showAllergies`, etc. |
| 4.3 | Card preview | Real-time preview as user fills form, dark vault-gradient style |
| 4.4 | QR code generation | Generate unique `qrCodeToken`, create QR code image |
| 4.5 | Public page `/emergency/[token]` | SSR page, no auth required, shows only toggled-on fields |
| 4.6 | Save to Apple Wallet | Generate `.pkpass` file with emergency data + QR code |
| 4.7 | Save to Google Wallet | Google Wallet API integration |
| 4.8 | Print layout | CSS `@media print` styles, credit-card size format |
| 4.9 | Convex CRUD | `emergency_cards` table: create, update, get, `by_qr_token` index |

### User Stories

**E6-S1: Emergency Card Creation**
> As a user, I want to create an emergency card with my vital medical information so that first responders can help me.

Acceptance Criteria:
- [ ] Form fields: Full Name, Blood Type (dropdown: A+, A-, B+, B-, O+, O-, AB+, AB-), Allergies (multi-line), Medical Conditions (multi-line), Current Medications (multi-line), Emergency Contact Name, Emergency Contact Phone, Additional Notes
- [ ] All fields optional (user fills what they want)
- [ ] Card saved to Convex `emergency_cards` table
- [ ] One card per user (create or update)

**E6-S2: Privacy Toggles**
> As a user, I want privacy toggles for each field on my emergency card so that I control exactly what is publicly visible.

Acceptance Criteria:
- [ ] ShadCN Switch toggle next to each field
- [ ] Default: all toggles OFF (maximum privacy by default)
- [ ] Card preview updates in real-time as toggles change
- [ ] Only toggled-ON fields appear on public QR page
- [ ] Toggle state stored in Convex: `showFullName`, `showBloodType`, etc.

**E6-S3: Public QR Code Page**
> As a first responder, I want to scan a QR code and see emergency information without any login so that I can help quickly.

Acceptance Criteria:
- [ ] QR code on card links to `/emergency/[qrCodeToken]`
- [ ] Public page renders without authentication (no login wall)
- [ ] Shows only fields where privacy toggle is ON
- [ ] Page styled with Keeplas branding (primary colors, clean layout)
- [ ] Loads fast: SSR with minimal JS
- [ ] Shows "Keeplas Emergency Card" header
- [ ] Shows "Last updated: [date]" at bottom

**E6-S4: Save to Wallet**
> As a user, I want to save my emergency card to Apple Wallet or Google Wallet so that it's always on my phone.

Acceptance Criteria:
- [ ] "Save to Apple Wallet" generates `.pkpass` file with QR code + visible fields
- [ ] "Save to Google Wallet" creates a JWT pass and opens Google Wallet
- [ ] Wallet pass shows: name, blood type, QR code at minimum
- [ ] Pass updates when card is modified (if platform supports)

**E6-S5: Print Physical Card**
> As a user, I want to print my emergency card as a physical card for my wallet.

Acceptance Criteria:
- [ ] "Print" button opens browser print dialog
- [ ] Print layout: credit-card dimensions (85.6mm x 53.98mm)
- [ ] Front: Name, blood type, allergies, QR code
- [ ] Back: Emergency contact, medical conditions, medications
- [ ] CSS `@media print` hides all non-card elements

### Milestone Verification
```
1. Navigate to Emergency Card → fill form → toggle some fields ON
2. Preview shows only toggled-ON fields in real-time
3. Save card → QR code generated
4. Open QR code URL in incognito browser → see public emergency info (no login)
5. Verify toggled-OFF fields are NOT shown on public page
6. Click "Save to Wallet" → verify pass created
7. Click "Print" → verify credit-card format in print preview
```

---

## 7. Phase 5 - Trusted Contacts (Weeks 14-17)

**Goal:** Invite contacts, distribute Shamir shards, implement Mode A (post-mortem) and Mode B1 (on-demand) access.

### Sprint 5A: Invitation + Shard Distribution (Week 14-15)

#### Tasks

| # | Task | Details |
|---|------|---------|
| 5.1 | Contact invitation form | Name (required), email (required), phone (optional), role dropdown |
| 5.2 | Role options | Family member, Friend, Lawyer, Doctor, Financial advisor, Other |
| 5.3 | Generate invitation token | Unique token, 72h expiry, stored in Convex |
| 5.4 | Send invitation email | Convex action: send email with invitation link |
| 5.5 | Invitation acceptance page | `/invite/[token]` — contact creates account or links existing |
| 5.6 | EC key pair generation | On acceptance: generate ECDH key pair for contact |
| 5.7 | Shard encryption + storage | Encrypt assigned shard with contact's public key, store in Convex |
| 5.8 | Contact list view | Cards with: name, role, status badge (pending/accepted/revoked), shard indicator |
| 5.9 | Contact detail view | Full info, assigned access modes, shard status, actions |
| 5.10 | First Responder toggle | Designate one contact as First Responder (only one allowed) |
| 5.11 | Medical Contact toggle | Designate contact for Mode B3 medical access |
| 5.12 | Max 5 contacts | Enforce maximum of 5 trusted contacts |
| 5.13 | Revoke contact | Remove contact, status → `revoked`, redistribute shards |
| 5.14 | Shard redistribution | Generate new shard set, re-encrypt for remaining contacts |

#### User Stories

**E7-S1: Invite Trusted Contact**
> As a user, I want to invite a trusted contact by entering their name, email, and role.

Acceptance Criteria:
- [ ] Form: name (required), email (required), phone (optional), role dropdown
- [ ] On submit: invitation token generated (72h expiry)
- [ ] Email sent to contact with personalized invitation link
- [ ] Contact appears in list with "Pending" badge
- [ ] Maximum 5 contacts enforced (error if attempting 6th)
- [ ] Audit log entry: `contact_invited`

**E7-S2: Accept Invitation**
> As an invited contact, I want to accept the invitation and create a Keeplas account so that I can receive my recovery fragment.

Acceptance Criteria:
- [ ] Invitation link `/invite/[token]` shows: inviter's name, their role designation, what it means
- [ ] Contact creates account (Passkey/Google/email) or links existing account
- [ ] EC key pair generated for contact
- [ ] Assigned shard encrypted with contact's public key
- [ ] Encrypted shard stored in Convex
- [ ] Contact status changes to `accepted`
- [ ] Contact receives their own 24-word Recovery Phrase (for shard recovery)
- [ ] Inviter notified of acceptance

**E7-S3: First Responder Designation**
> As a user, I want to designate one contact as First Responder for Life Check escalation.

Acceptance Criteria:
- [ ] Toggle "First Responder" on contact detail
- [ ] Only one First Responder at a time (selecting new one deselects previous)
- [ ] `isFirstResponder: true` flag set
- [ ] First Responder appears in Life Check configuration
- [ ] Warning if no First Responder is designated

**E7-S5: Assign Access Modes**
> As a user, I want to assign access modes (A, B1) to each contact so that I control what access they have.

Acceptance Criteria:
- [ ] Multi-select checkboxes: Mode A (Post-mortem), Mode B1 (On-demand)
- [ ] Mode A requires at least 2 contacts assigned (warning if less)
- [ ] `accessModes` array updated in Convex
- [ ] Contact sees which modes they're assigned to (on their dashboard)

**E7-S6: Revoke Contact**
> As a user, I want to revoke a trusted contact so that they lose all access.

Acceptance Criteria:
- [ ] "Revoke" action with confirmation dialog
- [ ] Contact status → `revoked`
- [ ] Contact's shard invalidated
- [ ] New shard set generated (Shamir re-split with updated shares)
- [ ] Remaining contacts receive new shards (async, next time they open app)
- [ ] Revoked contact notified
- [ ] Audit log entry: `contact_revoked`

---

### Sprint 5B: Access Modes A and B1 (Week 16-17)

#### Tasks

| # | Task | Details |
|---|------|---------|
| 5.15 | Mode B1: Request access UI | Contact sees "Request Access" for vaults they're trusted on |
| 5.16 | Mode B1: Request form | Reason, sections requested (category filter), urgency |
| 5.17 | Mode B1: Owner notification | Real-time notification via Convex subscription |
| 5.18 | Mode B1: Approve/deny UI | Approve with options: full/time-limited/section-limited, Deny button |
| 5.19 | Mode B1: Auto-deny | Configurable timeout (12h/24h/48h), silence = denial |
| 5.20 | Mode B1: Read-only vault | Contact sees approved items in read-only mode, no download for restricted |
| 5.21 | Mode B1: Access expiry | Auto-revoke after time limit, manual revoke button for owner |
| 5.22 | Mode A: Initiation | Contact initiates Mode A request (requires Life Check failure) |
| 5.23 | Mode A: Quorum check | Verify 2+ contacts independently initiated |
| 5.24 | Mode A: 72h grace period | Timer + notifications to all parties, owner can cancel |
| 5.25 | Mode A: Shard reconstruction | After grace: collect 3-of-5 shards, reconstruct key, unlock vault |
| 5.26 | Mode A: Read-only vault | All Mode A contacts see full vault in read-only mode |
| 5.27 | Access request states | State machine: pending → approved/denied/expired/cancelled |

#### User Stories

**E7-S7: Mode B1 - Request Access**
> As a trusted contact with Mode B1, I want to request access to the vault owner's vault.

Acceptance Criteria:
- [ ] Contact sees "Request Access" button on their Keeplas dashboard for vaults they're trusted for
- [ ] Request form: reason (required), sections/categories requested, urgency level
- [ ] Request created in `access_requests` with status `pending`
- [ ] Vault owner receives real-time notification (Convex subscription)
- [ ] Contact sees request status: "Pending approval"

**E7-S8: Mode B1 - Approve/Deny**
> As a vault owner, I want to approve or deny access requests with granular controls.

Acceptance Criteria:
- [ ] Notification card shows: contact name, reason, sections requested
- [ ] Approve options:
  - Full access (all categories)
  - Time-limited (24h, 48h, 7 days, custom)
  - Section-limited (select specific categories)
  - Read-only vs read+download
- [ ] Deny option with optional reason
- [ ] Auto-deny after configurable timeout (default 24h) — silence = denial
- [ ] On approval: contact sees read-only vault view limited to approved scope
- [ ] On expiry: access automatically revoked, both parties notified

**E7-S9: Mode A - Post-Mortem Access**
> As a trusted contact, I want to initiate post-mortem access along with another contact so that we can access the vault.

Acceptance Criteria:
- [ ] Requires Life Check to have fully failed (all channels exhausted, `emergency_access` status)
- [ ] Contact clicks "Initiate Emergency Access"
- [ ] System checks: Life Check status + Mode A assignment
- [ ] 2+ contacts must independently initiate (quorum)
- [ ] 72h grace period starts after quorum met
- [ ] All contacts + vault owner notified
- [ ] During grace period: owner can cancel (re-validate via any auth method)
- [ ] After grace period (no cancellation): 3-of-5 shard reconstruction
- [ ] Vault unlocked in read-only mode for all Mode A contacts
- [ ] Audit log: `emergency_access_triggered`

### Milestone Verification
```
1. Invite 3 contacts → each receives email
2. Contact 1 accepts → receives shard → status "Accepted"
3. Contact 1 requests Mode B1 access → owner gets notification
4. Owner approves with 24h limit → contact sees read-only vault
5. After 24h → access auto-revoked
6. Revoke contact 2 → shards redistributed
7. Test Mode A: simulate Life Check failure → 2 contacts initiate → grace period → vault unlocked
```

---

## 8. Phase 6 - Life Check MVP (Weeks 18-20)

**Goal:** Basic dead man's switch with push notification and email escalation.

### Sprint 6A: Configuration + Cycles (Week 18-19)

#### Tasks

| # | Task | Details |
|---|------|---------|
| 6.1 | Life Check config page | Frequency selector: Weekly, Monthly (default), Quarterly |
| 6.2 | Channel ordering UI | Drag-and-drop list: Push notification, Email (MVP channels only) |
| 6.3 | Delay configuration | Configurable wait time between channels |
| 6.4 | Travel mode toggle | Enable/disable with date picker (max 90 days) |
| 6.5 | Convex scheduled function | `lifeCheck.initiateCycle`: runs on configured frequency |
| 6.6 | Cycle state machine | `running → validated / escalating → triggered / cancelled` |
| 6.7 | Level 1: In-app notification | "Keeplas Life Check" notification with [I'm alive] + [Postpone] |
| 6.8 | Level 2: Email | Token-based confirmation link via email |
| 6.9 | Postpone options | 48h (once per cycle), 7 days, suspend until custom date |
| 6.10 | Cycle history page | List of past checks: date, method, status, validation type |

#### Escalation Timeline (MVP - Monthly)

```
Day 0:  Cycle starts
        ├── Check passive score (app activity only in MVP)
        ├── If score ≥ 50 → auto-validate, cycle complete
        └── If score < 50 → start active verification

Day 1:  Channel 1 - Push notification
        ├── "Keeplas Life Check - Confirm you are well"
        ├── [I'm alive] → validates cycle
        ├── [Postpone 48h] → reschedule
        └── No response in 24h → escalate

Day 2:  Channel 2 - Email
        ├── Email with unique confirmation link
        ├── Click link → validates cycle
        └── No response in 48h → escalate

Day 4:  Channel 3 - First Responder notification
        ├── In-app + email notification to First Responder
        ├── First Responder confirms "User is OK" → validates
        ├── First Responder confirms "User is NOT OK" → trigger
        └── No response in 24h → trigger

Day 5:  Emergency access triggered
        ├── 72h grace period starts
        ├── User can cancel during grace period
        └── After grace → Mode A available
```

#### User Stories

**E8-S1: Configure Frequency**
> As a user, I want to set how often Life Check verifies I'm alive.

Acceptance Criteria:
- [ ] Radio buttons: Weekly, Monthly (default), Quarterly
- [ ] Description for each: Weekly = "For active lifestyles", Monthly = "Recommended for most users", Quarterly = "Maximum exhaustive verification"
- [ ] `life_check_configs` record created/updated
- [ ] `nextCheckAt` calculated and displayed: "Next check: May 12, 2026"

**E8-S2: Configure Escalation Channels**
> As a user, I want to choose the order of escalation channels.

Acceptance Criteria:
- [ ] Channel list with drag-and-drop ordering
- [ ] MVP channels: Push notification, Email
- [ ] Each channel shows configurable delay (hours to wait before next channel)
- [ ] Default: Push (24h wait) → Email (48h wait) → First Responder (24h wait)
- [ ] Saved to `activeChannels` array in Convex

**E8-S3: Push Notification Check**
> As a user, I want to receive an in-app notification asking me to confirm I'm alive.

Acceptance Criteria:
- [ ] At `nextCheckAt`, Convex scheduled function fires
- [ ] In-app notification: "Keeplas Life Check — Confirm you are well"
- [ ] Two buttons: [I'm alive] and [Postpone 48h]
- [ ] [I'm alive] → cycle validated, `validatedBy: "tap"`, `validatedAt` set
- [ ] [Postpone 48h] → `nextCheckAt` pushed back 48h (once per cycle only)
- [ ] Notification persists until acted upon or escalated

**E8-S4: Email Escalation**
> As a user who missed the push, I want to receive an email with a confirmation link.

Acceptance Criteria:
- [ ] After push delay expires: email sent to user's registered email
- [ ] Email contains: explanation text + unique confirmation link (token, 48h expiry)
- [ ] Clicking link → validates cycle, shows "Thank you" page
- [ ] `currentLevel` escalated to 2
- [ ] `channelsAttempted` array updated with timestamp

**E8-S5: Postpone Check**
> As a user, I want to postpone a Life Check to handle temporary situations.

Acceptance Criteria:
- [ ] 48h postpone: available once per cycle, on any channel notification
- [ ] 7 days postpone: triggers soft "hospitalization" awareness
- [ ] Custom date: allows setting specific resume date
- [ ] `nextCheckAt` recalculated
- [ ] Audit log: `life_check_postponed`

**E8-S6: Travel Mode**
> As a user going on expedition, I want to suspend Life Check for up to 90 days.

Acceptance Criteria:
- [ ] Travel mode toggle with return date picker
- [ ] Maximum 90 days
- [ ] `travelModeEnabled: true`, `travelModeUntil: date`
- [ ] Life Check cycles paused until return date
- [ ] Confirmation dialog: "Life Check will be suspended until [date]. Your vault will not be monitored during this time."
- [ ] Trusted contacts NOT notified (privacy)

---

### Sprint 6B: Emergency Trigger + Dashboard Widget (Week 19-20)

#### Tasks

| # | Task | Details |
|---|------|---------|
| 6.11 | First Responder notification | In-app + email to designated First Responder |
| 6.12 | First Responder response UI | "User is OK" / "User is NOT OK" / "I don't know" options |
| 6.13 | Emergency trigger | After all channels exhausted → vault status `emergency_access` |
| 6.14 | 72h grace period | Timer, all parties notified, user can cancel |
| 6.15 | False positive cancellation | User re-authenticates → cancel emergency, notify all contacts |
| 6.16 | Dashboard widget | Last check (date, method), next check, status indicator |
| 6.17 | Audit logs | All Life Check events logged |

#### User Stories

**E8-S7: Life Check History**
> As a user, I want to see the history of my Life Checks.

Acceptance Criteria:
- [ ] Dedicated page or section showing past checks
- [ ] Each entry: date, validation method (icon + label), status badge
- [ ] Methods: "App confirmation", "Email confirmation", "First Responder confirmation", "Auto-validated"
- [ ] Most recent first, paginated

**E8-S8: Dashboard Widget**
> As a user, I want to see my Life Check status on the dashboard.

Acceptance Criteria:
- [ ] Widget shows:
  - Last check: "[Date] at [time]"
  - Via: "[Method icon] [Method name]"
  - Next check: "[Date]"
  - Status: "Active — Protection ongoing" (green) or "Attention needed" (orange)
- [ ] Link: "View history →"
- [ ] Travel mode: shows "Suspended until [date]"

**E8-TRIGGER-1: Emergency Access Trigger**
> As the system, when all Life Check channels are exhausted without response, I must trigger emergency access.

Acceptance Criteria:
- [ ] All configured channels exhausted (no response at any level)
- [ ] Vault status set to `emergency_access`
- [ ] 72h grace period timer starts
- [ ] All trusted contacts notified: "Emergency access protocol initiated for [user]. Grace period: 72 hours."
- [ ] User notified on all channels: "URGENT: Emergency access initiated. Cancel within 72 hours if you are safe."
- [ ] During grace period: user can authenticate + cancel
- [ ] After grace period: Mode A becomes available for contacts
- [ ] Audit log: `emergency_access_initiated`, `emergency_access_cancelled` or `emergency_access_confirmed`

### Milestone Verification
```
1. Configure Life Check: Monthly, Push → Email channels
2. Simulate cycle start → receive in-app notification
3. Ignore notification → after delay, receive email
4. Click email link → cycle validated
5. Test postpone: 48h → verify next check delayed
6. Enable Travel Mode → verify cycles paused
7. Simulate full failure: ignore all channels → First Responder contacted
8. First Responder confirms "NOT OK" → emergency triggered
9. Verify 72h grace period → user cancels → emergency cancelled
10. Dashboard widget shows correct status and dates
```

---

## 9. Phase 7 - Polish + Beta Launch (Weeks 21-23)

**Goal:** Production-ready application, launched as beta with payment.

### Tasks

| # | Task | Details |
|---|------|---------|
| 7.1 | Error handling | Loading states, error boundaries, graceful failures across all flows |
| 7.2 | Responsive design | Mobile browser pass: all pages work on 375px+ |
| 7.3 | i18n setup | `next-intl` or `next-i18next`: French (default) + English |
| 7.4 | Translate all strings | FR + EN for all user-facing text |
| 7.5 | Accessibility audit | Keyboard navigation, ARIA labels, screen reader testing |
| 7.6 | Rate limiting | Convex mutation rate limits (prevent abuse) |
| 7.7 | Input validation | Zod schemas for all form inputs, sanitize HTML/script |
| 7.8 | Security headers | CSP, X-Frame-Options, X-Content-Type-Options |
| 7.9 | Landing page | Hero section, value proposition, features overview, trust signals |
| 7.10 | Pricing page | $49 Lifetime Deal Beta, feature comparison |
| 7.11 | Stripe integration | Checkout session, webhook for payment confirmation, user upgrade |
| 7.12 | Legal pages | Terms of Service, Privacy Policy (template + customization) |
| 7.13 | SEO | Meta tags, OpenGraph, structured data |
| 7.14 | Analytics | Privacy-respecting analytics (Plausible or Umami) |
| 7.15 | Production deploy | Vercel (Next.js) + Convex Cloud |
| 7.16 | Domain setup | keeplas.com DNS, SSL |
| 7.17 | Email service | Transactional emails: Resend or SendGrid |
| 7.18 | Health check script | `scripts/health-check.sh` for monitoring |
| 7.19 | Beta signup/registration | Open registration or invite codes |

### Milestone Verification
```
1. Visit keeplas.com → see landing page
2. Sign up → complete onboarding → vault functional
3. Switch language FR ↔ EN → all text translates
4. Mobile test → all pages usable on phone
5. Pay $49 → Stripe checkout → account upgraded
6. Full user flow: sign up → add vault items → emergency card → invite contacts → configure Life Check
7. Security: verify no XSS, CSP headers present, rate limits work
```

---

## 10. Post-MVP Roadmap

| Phase | Feature | Estimated Sprints | Priority |
|-------|---------|-------------------|----------|
| 8 | Life Map (React Flow visualization, Continuity Score, Protected Zones) | 2 | High |
| 9 | AI Assistant (chat, vault completeness analysis, contextual suggestions) | 2 | High |
| 10 | Passive Signals for Life Check (app activity, device, GPS, health data scoring) | 2 | Medium |
| 11 | Modes B2 (permanent), B3 (medical emergency), B4 (conditional) | 1.5 | Medium |
| 12 | Conditional Messages (sealed messages, trigger conditions) | 1.5 | Medium |
| 13 | ZK Proofs with Noir/Barretenberg (replace placeholder shard 5) | 2 | Medium |
| 14 | Legal Legacy / Entrepreneur Portal (SOPs, succession, operational keys) | 2 | Low |
| 15 | Scenarios Engine (multi-step automated actions) | 1.5 | Low |
| 16 | WhatsApp + SMS + IVR channels for Life Check | 2 | Medium |
| 17 | Family Guide PDF (AI-generated, encrypted PDF export) | 1 | Low |
| 18 | Docker Compose self-hosting (Convex self-hosted, nginx, scripts) | 2 | Medium |
| 19 | PWA support (offline vault, service worker) | 1 | Low |
| 20 | Social Recovery flow (2 contacts submit shards to reconstruct) | 1 | Medium |

---

## 11. Dependency Graph

```
Phase 0 (Foundation)
    |
    v
Phase 1A (Design System) ──────┐
    |                           |
    v                           v
Phase 1B (Auth) ─────────> Phase 2 (Crypto + Onboarding)
    |                           |
    v                           v
Phase 4 (Emergency Card)    Phase 3 (Vault)
    [PARALLEL TRACK]            |
                                v
                           Phase 5 (Trusted Contacts)
                                |
                                v
                           Phase 6 (Life Check)
                                |
                                v
                           Phase 7 (Polish + Launch)
```

**Critical path:** Phase 0 → 1 → 2 → 3 → 5 → 6 → 7

**Parallel track:** Phase 4 (Emergency Card) can start as soon as Phase 1B (Auth) is done.

**Cross-cutting concerns:** Audit logging (E9) and Notifications (E10) are utilities built in Phase 0-1 and integrated into every subsequent phase.

---

## 12. Sprint Calendar

| Week | Phase | Deliverable |
|------|-------|-------------|
| 1-2 | Phase 0 | Bootable monorepo, CI green, all scaffolding |
| 3-4 | Phase 1A | Design system, ShadCN themed components, app shell |
| 4-5 | Phase 1B | Auth: Passkey, Google, Email/password |
| 6-7 | Phase 2A | `packages/crypto`: AES, BIP-39, Shamir |
| 7-8 | Phase 2B | Onboarding: Recovery Phrase, verification, Master Key |
| 9-10 | Phase 3A | Vault CRUD with client-side encryption |
| 10-11 | Phase 3B | Vault Integrity Score, Dashboard, nudges |
| 12-13 | Phase 4 | Emergency Card (parallel track) |
| 14-15 | Phase 5A | Trusted Contacts: invitation, shard distribution |
| 16-17 | Phase 5B | Access Modes A and B1 |
| 18-19 | Phase 6A | Life Check config and cycles |
| 19-20 | Phase 6B | Escalation and emergency trigger |
| 21-23 | Phase 7 | i18n, Stripe, responsive, security, beta launch |

**Total: ~23 weeks (6 months) for 2-person team.**
**Compressed: ~14-16 weeks with 3-4 developers** (parallelize crypto/backend + frontend + design/polish).

---

## 13. Risk Factors

| Risk | Impact | Mitigation |
|------|--------|------------|
| WebAuthn browser support in target markets (older Android) | Users can't register with Passkey | Email+password fallback always available. Test Chrome for Android 80+ |
| Convex scheduled functions reliability | Life Check cycles missed | Build idempotent cycle initiation. Check for missed cycles on recovery |
| Client-side crypto performance on low-end devices | Slow onboarding, poor UX | Use Web Workers for crypto operations. Profile on mid-range Android early |
| Shard redistribution complexity on contact revocation | Async coordination needed | Design as async: contacts receive new shards next app open. Old set valid during transition |
| Noir/Barretenberg WASM bundle (~10MB+) | Slow initial load | Defer ZK to post-MVP. Use simpler encryption for shard 5 in MVP |
| Email deliverability in Africa (spam filters) | Life Check emails not received | Use reputable email provider (Resend/SendGrid). Add SPF/DKIM/DMARC. WhatsApp channel post-MVP |
| Data sovereignty (GDPR, local laws) | Legal compliance | Document data flow. All sensitive data client-encrypted. Convex stores ciphertext only |
| Single Convex provider lock-in | Business risk | Convex is self-hostable. Document migration path. Abstract data layer |
