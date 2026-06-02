# Keeplas — Architecture, Security & Product Decisions

> Complete recap document — May 2026 — v5.1
>
> **Changes v5 → v5.1**: simplified access model (removal of modes B1–B4 and the First Responder role, merge of Medical Contact / Legal Authority into the standard `role`), configurable Shamir threshold (2-of-5 by default, 5 max), peer-to-peer ML-KEM distribution + submission flow described.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Main Screens](#2-main-screens)
3. [Final Tech Stack](#3-final-tech-stack)
4. [Monorepo Structure](#4-monorepo-structure)
5. [Security & Contribution Architecture](#5-security--contribution-architecture)
6. [Cryptography — Zero Knowledge](#6-cryptography--zero-knowledge)
7. [Authentication & Recovery](#7-authentication--recovery)
8. [Life Check — Survival Verification System](#8-life-check--survival-verification-system)
9. [Life Check — Passive Signals & Confidence Score](#9-life-check--passive-signals--confidence-score)
10. [Life Check — Last Check Display](#10-life-check--last-check-display)
11. [Trusted Contacts Access](#11-trusted-contacts-access)
12. [Onboarding — Optimal UX](#12-onboarding--optimal-ux)
13. [Installation Scripts](#13-installation-scripts)
14. [License & Governance](#14-license--governance)
15. [Contribution Standards](#15-contribution-standards)
16. [Key Decisions Summary](#16-key-decisions-summary)

---

## 1. Project Overview

**Keeplas** is a **Life Continuity Platform** — a platform that lets users secure, organize, and transmit their vital information (assets, medical directives, legal legacy, trusted contacts) in an encrypted and decentralized way.

|                      |                                             |
| -------------------- | ------------------------------------------- |
| **CEO / Co-founder** | Prince (51%)                                |
| **CTO / Co-founder** | Ghislain MITAHI (49%)                       |
| **Target market**    | Kenya, Cameroon, French diaspora, DRC       |
| **Business model**   | Freemium + Lifetime Deal Beta at $49        |
| **Approach**         | Open source (AGPL v3 + CLA) + self-hostable |

### Value proposition

Keeplas solves three fundamental problems:

- **Continuity** — ensure loved ones have access to vital information if the user becomes incapacitated or passes away
- **Security** — no entity (not even Keeplas) can access the vault without the user's consent
- **Control** — the user defines precisely who accesses what, when, and under which conditions

---

## 2. Main Screens

The application comprises 4 main screens identified in the mockups:

### Life Map / Dashboard

Holistic view of the legacy with a "central node" in the center, a continuity score (e.g. 75% — Strong Protection), an AI Completeness Analyzer, and Protected Zones (Financial Redundancy, Trusted Node Mesh, Real Estate Chain, Healthcare Directive Gap).

### AI Assistant

Chat interface for vault curation. The assistant analyzes vault completeness, asks targeted questions, offers quick replies, and generates a Family Guide exportable as an encrypted PDF. An "END-TO-END ENCRYPTED SESSION" indicator stays visible at all times.

### Legal Legacy — Entrepreneur Portal

Portal dedicated to entrepreneurs: professional procedures (SOPs, succession plan), Operational Access Keys (encrypted credentials), Business Associates, Contingency Instructions (24h actions, equity distribution), Operational Asset Registry with CSV export.

### Emergency Card

Public emergency identity card with Privacy Controls (Full Name, Blood Type, Allergies, Emergency Contact). Accessible to first responders even when the vault is locked. Options: Save to Wallet, Print Physical Card.

---

## 3. Final Tech Stack

```
Next.js (App Router)        ← Web-first + PWA ready
├── ShadCN UI               ← Components in the repo (not a black box)
├── Tailwind CSS            ← Native styling
├── Convex                  ← Realtime backend + DB (Cloud or Self-hosted)
├── Convex Auth             ← Integrated authentication
├── WebAuthn (Passkey)      ← Recommended auth — local biometrics
├── React Flow              ← Graph visualization (Life Map only)
└── packages/crypto/        ← ZK + AES + Shamir (isolated and auditable)
```

> Note: this is the originally-specified stack. The web app has since moved to **TanStack Start (Vite)**; see [`docs/STACK.md`](../docs/STACK.md) for the current stack and the rationale.

### Rationale for the choices

**Next.js App Router**

- Web-first with PWA possible via `next-pwa` if needed
- No React Native at first — avoids the complexity of a mobile monorepo
- Native SSR/SSG, performant, well-known to open-source contributors
- Native responsive — works on mobile via the browser

**ShadCN UI**

- The components are copied into the repo (`components/ui/`) — not an external dependency
- A contributor opens `button.tsx` and sees plain Tailwind, no magic
- Standard of the Next.js ecosystem — most contributors know it
- Accessible by default (Radix UI underneath) — important for a trust product
- Theming via CSS variables: the teal/dark-navy palette from the mockups is easily configurable

**ShadCN components used**
| UI element | ShadCN component |
|---|---|
| Privacy Controls toggles | `Switch` |
| Guide Readiness progress bars | `Progress` |
| ENCRYPTED, PROTECTED badges | `Badge` |
| Asset Registry tables | `Table` |
| Life Map node cards | `Card` |
| Chat input + quick replies | `Input` + `Button` |
| Dropdown actions (⋮) | `DropdownMenu` |
| Sidebar navigation | Custom layout |

**Convex Auth + WebAuthn (Passkey)**

- Passkey recommended by default — local biometrics, the private key is never transmitted
- Perfect alignment with the ZK philosophy: nothing secret leaves the device
- Phishing-resistant (bound to the keeplas.com domain only)
- Multi-device via iCloud Keychain / Google Password Manager
- Fallback: Google OAuth, Apple OAuth, Email + password
- In all cases, the Recovery Phrase remains the ultimate backup
- Realtime out of the box
- Available as Cloud (managed) or Self-hosted (Docker) at the user's choice
- Integrates cleanly into a Turborepo monorepo

**pnpm + Turborepo**

- Faster than npm, centralized store (no `node_modules` duplication)
- Native monorepo with workspaces
- Blocks phantom dependencies — reduces supply-chain attack risks
- Modern open-source standard

**React Flow** (Life Map only)

- ShadCN does not cover graph/node visualizations
- Required for the dashboard's "central node" and its connections

---

## 4. Monorepo Structure

```
keeplas/
├── apps/
│   └── web/                        ← Next.js app (Web + PWA)
│       ├── app/                    ← App Router pages
│       ├── components/
│       │   ├── ui/                 ← ShadCN components
│       │   ├── vault/
│       │   ├── life-check/
│       │   ├── trusted-contacts/
│       │   └── emergency-card/
│       └── lib/
├── packages/
│   ├── crypto/                     ← RESTRICTED zone ⚠️
│   │   ├── zk/                     ← Noir/Barretenberg circuits
│   │   ├── aes/                    ← AES-256-GCM (Web Crypto API)
│   │   ├── shamir/                 ← Secret Sharing threshold-of-5 (configurable, 2 by default)
│   │   └── __tests__/              ← Isolated unit tests
│   ├── convex/                     ← Convex Schema + Functions
│   └── ui/                         ← Shared ShadCN components
├── scripts/
│   ├── install.sh                  ← Universal installation script
│   ├── setup-dev.sh                ← Dev environment setup
│   ├── setup-convex.sh             ← Convex installation (Cloud or Self-hosted)
│   ├── setup-crypto.sh             ← Noir/Barretenberg installation
│   └── health-check.sh             ← Check that everything runs
├── security/
│   └── audits/                     ← Public audit reports
├── docker-compose.yml              ← Production self-hosting
├── docker-compose.dev.yml          ← Local development
├── .env.example                    ← All variables documented
├── turbo.json                      ← Turborepo configuration
├── pnpm-workspace.yaml             ← pnpm workspaces
├── .github/
│   ├── CODEOWNERS
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── security.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── security_vulnerability.md  ← Redirects to a private email
│   └── PULL_REQUEST_TEMPLATE.md
├── LICENSE                         ← AGPL v3
├── CONTRIBUTOR_LICENSE_AGREEMENT.md
├── CONTRIBUTING.md
├── SECURITY.md
└── CODE_OF_CONDUCT.md
```

---

## 5. Security & Contribution Architecture

### Strict zone separation

| Zone               | Scope                      | Access           |
| ------------------ | -------------------------- | ---------------- |
| `apps/web/`        | UI, pages, components      | ✅ Everyone      |
| `packages/ui/`     | ShadCN components          | ✅ Everyone      |
| `packages/convex/` | Schema, queries, functions | ✅ Everyone      |
| `packages/crypto/` | ZK, AES, Shamir            | ⚠️ Founders only |
| `security/`        | Audits, reports            | ⚠️ Founders only |

### CODEOWNERS

```
# .github/CODEOWNERS
/packages/crypto/     @prince-keeplas @ghislain-keeplas
/security/            @prince-keeplas @ghislain-keeplas
/apps/web/            *
/packages/ui/         *
/packages/convex/     *
```

Any PR touching `/crypto` cannot be merged without explicit approval from both founders.

### Security CI/CD pipeline

```yaml
# .github/workflows/security.yml
- CodeQL              ← Static code analysis
- Dependabot          ← Dependency vulnerabilities
- pnpm audit          ← Package audit
- Crypto tests        ← Mandatory before any merge on /crypto
- Snyk / Socket.dev   ← Supply-chain attacks
```

### What we NEVER put in the public repo

- `.env` files with real values
- Internal production infra scripts
- Internal security audits
- Encryption keys (never, in any form)
- Account credentials (Convex, email, backup)

---

## 6. Cryptography — Zero Knowledge

### Cryptographic stack

| Component             | Technology                           | Role                                                                                 |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------------------------ |
| Zero-Knowledge Proofs | Noir + Barretenberg                  | Client-side ZK proofs — auditable                                                    |
| Symmetric encryption  | AES-256-GCM (Web Crypto API)         | Client-side vault encryption                                                         |
| Secret Sharing        | Shamir threshold-of-5 (configurable) | Key distribution and recovery. Threshold chosen at onboarding (2-5); default 2-of-5. |
| ML-KEM-768 (FIPS 203) | @noble/post-quantum                  | Wraps shards and DEKs to recipient public keys (post-quantum, replaces RSA-OAEP)     |

### Isolation principle

The `packages/crypto/` package is fully isolated so that:

- Security auditors can review it independently of the app
- Unit tests are separate and exhaustive
- Versioning is independent
- Non-crypto contributors can contribute without touching it

### User vocabulary (never technical jargon in the UI)

| Technical term        | UI term                                                   |
| --------------------- | --------------------------------------------------------- |
| Shamir shard          | Key fragment                                              |
| ZK Proof              | Secure identity proof                                     |
| Master Key            | Personal secret key                                       |
| AES-256-GCM           | End-to-end encryption                                     |
| Quorum threshold-of-5 | "X contacts out of 5 required" (X depends on user choice) |

---

## 7. Authentication & Recovery

### Generation at sign-up

```
Master Key (256 bits) — generated locally, never transmitted
      ↓
AES-256-GCM encrypts the entire vault
      ↓
Shamir Secret Sharing → split into 5 shards (threshold: 3)
      ↓
Distribution of the 5 shards
```

### Shard distribution

```
Shard 1 → User's device         (encrypted, local biometrics/PIN)
Shard 2 → Trusted Contact A     (stored in their Keeplas app)
Shard 3 → Trusted Contact B     (stored in their Keeplas app)
Shard 4 → Trusted Contact C     (stored in their Keeplas app)
Shard 5 → Keeplas               (encrypted, inaccessible without ZK proof)
```

To decrypt the vault: **3 of the 5 shards are required**. No single entity (neither Keeplas nor a single contact) can open the vault.

### User recovery (device loss)

**Option A — Social Recovery**

```
At least 2 trusted contacts confirm the user's identity
Each submits their shard via their own Recovery Phrase
Quorum reached → a new shard is generated for the new device
```

**Option B — Personal Recovery Phrase**

```
24 words generated at sign-up (BIP-39)
Let the user rebuild the Master Key without the contacts
To be written on paper — never photographed
```

### Trusted Contacts recovery

Each trusted contact receives at their onboarding:

- Their Shamir shard (stored in the Keeplas app on their device)
- Their own 24-word Recovery Phrase to retrieve their shard if they lose their device

**Critical case**: if a trusted contact loses both their shard AND their Recovery Phrase, the user must replace them manually and redistribute the affected shards.

### Replacing a Trusted Contact

```
User initiates the replacement from their vault
      ↓
New contact invited and onboarded
      ↓
New shards generated and redistributed
      ↓
Old shard revoked and invalidated
      ↓
Notification to all contacts about the change
```

---

## 8. Life Check — Survival Verification System

### Anti-false-positive philosophy

> Never trigger emergency access on a single missed signal. Always escalate progressively across all configured channels.

### User-configurable frequencies

| Frequency     | Recommended profile                  | Total delay before triggering |
| ------------- | ------------------------------------ | ----------------------------- |
| **Weekly**    | High-risk situation, serious illness | ~5 days                       |
| **Monthly**   | Standard — recommended default       | ~5 days                       |
| **Quarterly** | Young, healthy                       | ~14 days minimum              |

### Configurable channels (ordered by the user)

The user defines their escalation order among these channels:

```
□ In-app notification (push)
□ Email
□ WhatsApp / SMS
□ Automated call (IVR)
```

Drag & drop in the interface lets the user reorder the channels freely. Human validation as a last resort is now carried by **all** trust contacts via their `Mark as unreachable` action (see section 11) — there is no longer a separate "First Responder" role.

### Monthly workflow (Standard)

```
Day D — 09:00
├── Channel 1: Push notification
│   "Keeplas Life Check — Confirm that you're OK"
│   [I'm alive ✅]  [Postpone 48h]
│
│   ← No response after 24h
│
├── Day D+1 — Channel 2: Email + Channel 3: WhatsApp (simultaneous)
│   Unique confirmation link (72h token)
│   [I'm alive ✅]  [I'm hospitalized — postpone 7d]
│
│   ← No response after an additional 48h
│
├── Day D+3 — Channel 4: Automated IVR call
│   "Press 1 if you're alive"
│   "Press 2 to postpone by 7 days"
│   3 attempts, 4h apart
│
│   ← No response
│
├── Day D+4 — cycle.status = "escalating"
│   All trust contacts notified.
│   ≥threshold contacts click "Mark as unreachable"
│   to confirm human unreachability.
│
│   ← Quorum reached
│
└── Day D+5 → Emergency access protocol triggered (72h grace)
```

### Weekly workflow (Accelerated)

```
Day D      Channel 1                → 12h no response
Day D+0.5  Channel 2+3              → 24h no response
Day D+1.5  Channel 4 (IVR)         → 36h no response
Day D+2    Escalating (contacts)   → human quorum
Day D+2.5  → Triggered
```

### Quarterly workflow (Exhaustive — strict rule)

```
⚠️ ALL configured channels must be exhausted
   before any triggering — without exception.

Day D       Channel 1         → 72h no response
Day D+3     Channel 2+3       → 5 days no response
Day D+8     Channel 4 (IVR)   → 7 days no response
Day D+13    Channel 5 (FR)    → mandatory human confirmation
Day D+14    → Triggered (minimum D+14)
```

### Special cases

**Travel / Expedition**

```
User suspends the Life Check (max 90 days)
Mandatory confirmation of resume date
"Expedition" mode for areas without network:
  → Delays automatically extended
  → First channel = SMS (more reliable offline)
```

**Hospitalization**

```
Triggered by the user before hospitalization (pause mode)
OR by a designated medical Trusted Contact
Configurable automatic resume date
```

**Post-trigger false positive**

```
72h grace window after triggering
The user can cancel emergency access within this window
Cancellation log visible to all trusted contacts
Immediate notification to all contacts on cancellation
```

**Manual postpone**

```
Options available at each channel:
  → Postpone 48h (once per cycle only)
  → Postpone 7 days (hospitalization mode)
  → Suspend until [date] (travel mode)
```

---

## 9. Life Check — Passive Signals & Confidence Score

### Principle: "Passive First, Active Only If Needed"

Passive verification is the first line of defense. The user is only solicited actively if passive signals are insufficient. Goal: zero friction for a living, active user.

```
Level 0 — Automatic passive signals       ← Zero user action
Level 1 — Light confirmation (one tap)     ← Only if level 0 fails
Level 2 — Active channels (email, SMS...)  ← Only if level 1 fails
Level 3 — Trust contacts confirm           ← Collective human action
Level 4 — Emergency access triggered (72h grace then Shamir quorum)
```

---

### Level 0 — Available passive signals

**Via the Keeplas app**

```
Last app open
Last interaction (scroll, tap, navigation)
Last vault modification
Last active session
```

**Via the mobile system / browser**

```
Device activity (screen unlock)
→ Android: "Usage Stats" permission
→ iOS: last detectable app session

GPS location (optional, if the user allows it)
→ Movement detected = positive signal
→ Usual location = positive signal

Health / physical activity (optional)
→ Apple Health / Google Fit
→ No movement for 48h = alert signal
→ Abnormal heart rate = alert signal
```

**Via third-party services (optional, explicit consent)**

```
WhatsApp Business API
→ Detection of recent "online" presence
→ No message sent — just passive detection

Google Activity
→ Last Gmail, Drive, Search activity
→ Strong signal of active life

Calendar (Google / Apple)
→ Future events created recently
→ Accepted meetings = signal of life

Apple Watch / Wear OS
→ Heart rate, activity, sleep
→ Integration via Health API
```

---

### Confidence Score

Each signal has a weight. The score determines whether level 0 validates the cycle or whether we must move to level 1.

| Signal                     | Weight | Detection window |
| -------------------------- | ------ | ---------------- |
| Keeplas app open           | 40 pts | 15 days          |
| Vault interaction          | 30 pts | 15 days          |
| Device activity (unlock)   | 20 pts | 7 days           |
| GPS movement               | 20 pts | 7 days           |
| WhatsApp activity          | 15 pts | 10 days          |
| Google / Calendar activity | 15 pts | 10 days          |
| Normal health data         | 25 pts | 3 days           |
| Apple Watch / heart rate   | 35 pts | 24h              |

**Passive validation threshold: ≥ 50 points**
Below the threshold → automatic move to level 1.

---

### Revised monthly workflow with passive signals

```
Day D — Verification due
│
├── LEVEL 0: Silent collection (automatic)
│   Score ≥ 50 pts → ✅ Cycle validated silently
│                     Next check in 30 days
│                     No action requested from the user
│
│   Score < 50 pts → Level 1
│
├── LEVEL 1: Light confirmation (D+1)
│   Discreet push notification:
│   "All good? [👍]"  ← a single tap, no screen
│   Response within 24h → ✅ Cycle validated
│   No response → Level 2
│
├── LEVEL 2: Active channels (D+2 to D+4)
│   Email → WhatsApp → IVR (order configured by the user)
│   Each channel: configurable delay
│   No response → Level 3
│
├── LEVEL 3: Trust contacts confirm (D+4)
│   All trust contacts notified "We can't reach [user]"
│   ≥threshold click "Mark as unreachable" from their dashboard
│   No quorum → cycle stays pending without triggering
│
└── LEVEL 4: Emergency access triggered (D+5)
    72h grace starts. On expiry: Shamir phase (shard submission
    + MasterKey reconstruction on the contact side, never on the server).
```

---

### Impact of passive signals on frequencies

```
Weekly
→ Level 0 checked silently every week
→ User solicited only if 0 signal over 7 days
→ Near-zero friction in practice

Monthly
→ Level 0 checked at D, D+3, D+7 (3 passive attempts)
→ If insufficient → Level 1 (one tap)
→ Minimal friction

Quarterly
→ Level 0 checked several times over 2 weeks
→ All active channels mandatory if level 0 fails
→ Emergency triggering nearly impossible without a real absence
```

---

### User configuration of passive signals

```
Passive signals — Settings
─────────────────────────────────────────────────────
✅ Keeplas in-app activity            (always on)
✅ Device activity                    (recommended)
□  GPS location                       (optional)
□  WhatsApp activity                  (optional)
□  Google / Calendar activity         (optional)
□  Apple Health / Google Fit          (optional)
□  Apple Watch / Wear OS              (optional)
```

Encouragement indicator in the app:

```
"With your current settings:
 Probability of being solicited manually: High

 Enable GPS location to reduce
 manual checks"
```

---

### Privacy rules for passive signals

- Explicit consent for each signal (opt-in only)
- Data processed locally on the device when possible (on-device)
- Never sold or used for any purpose other than the Life Check
- Removable at any time from the settings
- Full transparency: the user sees exactly which signal validated their cycle

---

### Limits and false positives of passive signals

Some signals can be misleading — hence the multi-signal scoring:

```
GPS active but user unconscious in an ambulance → false positive
Device unlocked by someone else                 → false positive
Apple Watch worn by someone else                → false positive
```

A single strong signal is never enough. The 50-pt threshold requires combining several independent sources.

---

## 10. Life Check — Last Check Display

### Transparency principle

The user and their trusted contacts must always know when the last check happened and how it was validated. It is a fundamental element of trust in the product.

---

### Information displayed

```
Last check        : April 12, 2026 at 09:14
Type              : Automatic (app activity)
Next check        : May 12, 2026
Status            : ✅ Active — Protection in progress
```

### Granularity by signal type

Each check states precisely how it was validated:

| Icon | Type      | Description                             |
| ---- | --------- | --------------------------------------- |
| ✅   | Automatic | Keeplas in-app activity                 |
| ✅   | Automatic | Device activity                         |
| ✅   | Automatic | GPS movement detected                   |
| ✅   | Automatic | WhatsApp activity                       |
| ✅   | Automatic | Google / Calendar activity              |
| ✅   | Automatic | Normal health data                      |
| 👆   | Manual    | Confirmation by tap                     |
| 📧   | Manual    | Confirmation by email                   |
| 📞   | Manual    | Confirmation by call                    |
| 👤   | Manual    | Confirmed by a quorum of trust contacts |

---

### Where to display this information

**Dashboard / Life Map — Life Check widget**

```
┌─────────────────────────────────────────┐
│ 🛡️  Life Check                           │
│                                         │
│ Last check       Apr 12, 2026  09:14    │
│ Via              Automatic (app)        │
│ Next check       May 12, 2026           │
│                                         │
│ [View history]                          │
└─────────────────────────────────────────┘
```

**Life Check page — full history**

```
April 2026
──────────────────────────────────────────────
✅ Apr 12  09:14   Automatic (app)
✅ Mar 12  14:32   Automatic (GPS)
👆 Feb 10  11:05   Manual (tap)
✅ Jan 10  —       Automatic (WhatsApp)

[Load more]
```

**Trusted Contact view — limited information**

Contacts see the status but not the signal detail (user privacy):

```
[User name]
Last check     : 3 days ago  ✅
Status         : Active
Next check     : In 27 days
```

---

## 11. Trusted Contacts Access

### Simplified model — one flow, two roles

The model was deliberately simplified to align the zero-knowledge promise with the UX. **Trusted Contact** is the only active role (validation + holding a shard + opening the vault). **Recipient** is the passive role (receiving pre-assigned content after opening). No more B1/B2/B3/B4 modes, no more First Responder, no more Medical Contact or Legal Authority as distinct roles.

```
TRUSTED CONTACT (active) — holds 1 Shamir shard
  ① Confirms the user's unreachability (human validation)
  ② Submits their shard once the grace period has expired
  ③ Participates in the cryptographic quorum (threshold-of-5)

RECIPIENT (passive) — no shard, no validation
  Receives pre-assigned content after the vault is opened
```

---

### Configurable threshold

The user chooses their threshold at onboarding (between 2 and 5). Stored in `users.vaultThreshold`. The default **2-of-5** maximizes recovery ease; a higher threshold strengthens collusion resistance but requires more reachable contacts at recovery time. Changing the threshold after distribution implies a full re-distribution of the shards.

| Threshold            | Trade-off                                                                 |
| -------------------- | ------------------------------------------------------------------------- |
| **2-of-5** (default) | Easy recovery. 2 contacts suffice. Less resistant to collusion by a pair. |
| **3-of-5**           | Resists one compromised pair.                                             |
| **4-of-5**           | Strong security. Recovery may block if ≥2 contacts unavailable.           |
| **5-of-5**           | No collusion possible. A single missing contact = vault locked.           |

---

### Post-mortem access flow (single)

```
1. DETECTION
   Passive Life Check fails (insufficient signals)
       ↓
   Active channels (push → email → WhatsApp → SMS → IVR) try
   to reach the user. All fail → cycle.status = "escalating"

2. NOTIFICATION
   All trusted contacts notified:
   "We can't reach [user]"

3. SOCIAL CONFIRMATION
   ≥threshold contacts click "Mark as unreachable" from
   /shared-with-me (button visible only when the owner's
   cycle is escalating).
       ↓
   access_request.contactsInitiated.length reaches the quorum
       ↓
   Notification to the user + start of the 72h countdown

4. GRACE PERIOD 72H
   The user has one last window to reappear. Sign-in +
   "I am well" → cycle cancelled, request closed, contacts notified.
   No content ever leaves the vault in this scenario.

5. CRYPTOGRAPHIC SUBMISSION
   After the 72h, each trust contact can submit their shard.
   The raw shard is read from local IndexedDB, then wrapped with
   ML-KEM-768 to the public key of every other trust contact
   (fan-out wrap). The server stores only the envelopes.

6. CLIENT-SIDE RECONSTRUCTION
   When ≥threshold contacts have submitted their shard, any
   submitter can:
     - fetch the envelopes addressed to them
     - unwrap them with their ML-KEM private key
     - combine with their own local shard
     - reconstruct the MasterKey via Shamir (client-side only)

7. DISTRIBUTION
   With the MasterKey, the contact opens the vault in "memorial"
   read mode. Recipients receive the pre-assigned content
   according to the recipient_groups + sharedWithContacts defined
   by the user while alive.
```

---

### Safeguards

- **Fail-closed on validation**: if no trust contact confirms unreachability, the vault stays closed indefinitely. No automatic server-side timeout that would open the vault without human intervention.
- **72h grace**: the user can always cancel while the window has not elapsed. Cancellation notifies all contacts.
- **Strict zero-knowledge**: the server never sees a shard in clear. Distribution = ML-KEM wrap; submission = peer-to-peer ML-KEM wrap (fan-out); reconstruction = client-side only.
- **Collusion trade-off**: with threshold = 2, two colluding contacts can both confirm unreachability AND open the vault. The Life Check (failure on all channels) + the 72h grace remain the only additional safeguards. The user can raise the threshold if they anticipate this risk.
- **Immutable audit**: every action (mark unreachable, submit shard, reconstruction) is traced in `audit_logs` with tamper-evident hash-chaining.

---

### What was removed from the initial model

| Removed concept                           | Reason                                                                                                                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Modes B1/B2/B3/B4**                     | Product scatter. The Keeplas v1 promise is digital succession, not a general-purpose sharing platform.                                                                                           |
| **First Responder**                       | Duplicated the social confirmation by trust contacts. The function (human validation) is kept but carried by all trust contacts via `markUserUnreachable`.                                       |
| **Medical Contact / Legal Authority**     | Useless distinct roles. Each contact's `role` (lawyer, doctor, family, friend, other) is enough for the business semantics; no crypto privilege attached.                                        |
| **Living recovery via on-demand request** | A living user uses their 24-word phrase (path A). If the phrase is lost, they can manually trigger a recovery via the contacts (path B), which follows exactly the same post-mortem Shamir flow. |

---

### Living recovery

If the user loses access to their device but still has their 24-word phrase:

- Argon2id(24 words, phraseSalt) → RootKey → unwrap(encryptedKeyBundle) → MasterKey. No contact involved.

If the user loses the 24-word phrase:

- The trust contacts can collaborate (≥threshold) to reconstruct the MasterKey, exactly as in the post-mortem case. The user can then generate a new phrase and re-wrap the MasterKey under a new RootKey. The vault is unchanged; only the access phrase changes.

The 24 words themselves are never recoverable — it is a one-way derivation. No entity (Keeplas, contacts, another device) can reproduce them.

---

## 12. Onboarding — Optimal UX

### General philosophy

> The app is the guide. No funnel, no forced demo. The user lands in the product and naturally understands what to do thanks to the score, contextual nudges, and the assistant.

Only two blocking steps — everything else is progressive discovery.

```
BLOCKING    → Step 0: Sign-up (2 min)
BLOCKING    → Step 1: Recovery Phrase (90 seconds)
PROGRESSIVE → Everything else via Vault Integrity Score + nudges
```

---

### Step 0 — Sign-up (2 minutes max)

Minimalist screen. We only ask for the strict minimum. Passkey is offered first — it is the most secure and smoothest choice.

```
┌─────────────────────────────────────────┐
│           🔐 Keeplas                    │
│                                         │
│   Secure your legacy in 2 minutes      │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │  🪪 Create with Passkey  ★      │   │
│   │     Face ID / Fingerprint       │   │
│   │     The most secure             │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ──────────── or ────────────          │
│                                         │
│   [Continue with Google]                │
│   [Continue with Apple]                 │
│                                         │
│   ──────────── or ────────────          │
│                                         │
│   Email                                 │
│   Password                              │
│                                         │
│   [Create my vault →]                   │
└─────────────────────────────────────────┘
```

Tooltip ℹ️ on clicking "Passkey":

```
"A Passkey uses your biometrics (Face ID, fingerprint)
 instead of a password. Your key stays on your device —
 neither Keeplas nor anyone else can access it.
 If you change devices, your Passkey syncs
 automatically via iCloud or Google."
```

**Recommended priority order:**

```
1. 🥇 Passkey          ← Recommended — the most secure, zero friction
2. 🥈 Google / Apple   ← Simple, familiar
3. 🥉 Email + password  ← Always available, less secure
```

What we do NOT ask at this step: full name, phone, date of birth, pricing plan. All of that comes naturally later when the context requires it.

---

### Step 1 — Recovery Phrase (BLOCKING — 90 seconds)

The only moment where we force the user to stop. Presented as a protection, never as a constraint.

```
┌─────────────────────────────────────────────┐
│                                             │
│  🔑 Your personal secret key                │
│                                             │
│  Before accessing your vault, we            │
│  generate a unique key that never           │
│  leaves this device.                        │
│                                             │
│  If you lose access to your account,        │
│  these 24 words are your only recourse.     │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ 1. harbor   2. crystal  3. motion   │    │
│  │ 4. legacy   5. breach   6. silent   │    │
│  │ ...         ...         ...         │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ⚠️  Write these words on paper.            │
│      Never photograph them.                 │
│                                             │
│  [📋 Copy]   [🖨️ Print]                    │
│                                             │
│  [I've written down my 24 words →]         │
└─────────────────────────────────────────────┘
```

Immediate quick check:

```
Confirm 3 words to continue:

Word #7 is:   [          ]
Word #14 is:  [          ]
Word #21 is:  [          ]

[Confirm and access my vault →]
```

The words "shard", "ZK", or "Shamir" never appear on this screen.

---

### Step 2 — Arrival in the Dashboard (first access)

The user lands directly in the app. No slides, no tutorial pop-up, no overlay.

```
┌──────────────────────────────────────────────────────────────┐
│ Keeplas          Vault   Life Check   Emergency   Contacts   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Welcome. Your vault is ready.                               │
│  Start securing your legacy at your own pace.                │
│                                [🔒 VAULT ENCRYPTED & SECURE] │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────────────────────┐  │
│  │                  │  │  📁 Personal documents            │  │
│  │      0%          │  │  No document added                │  │
│  │   VAULT          │  ├──────────────────────────────────┤  │
│  │   INTEGRITY      │  │  💰 Financial assets              │  │
│  │                  │  │  No asset added                   │  │
│  │  Add your        │  ├──────────────────────────────────┤  │
│  │  first document  │  │  🏢 Business Continuity           │  │
│  │  to get started  │  │  Not configured                   │  │
│  └──────────────────┘  └──────────────────────────────────┘  │
│                                                              │
│  PRIORITY ACTIONS                                           │
│  ┌──────────────────────────────────┐                        │
│  │ ➕ Add a first document          │ ›                      │
│  ├──────────────────────────────────┤                        │
│  │ 👤 Invite a contact              │ ›                      │
│  ├──────────────────────────────────┤                        │
│  │ 🪪 Create my emergency card      │ ›                      │
│  └──────────────────────────────────┘                        │
│                                                              │
│  ⚠️  Your vault is not yet shareable in an emergency.       │
│     [Invite a contact →]   [Remind me in 48h]              │
└──────────────────────────────────────────────────────────────┘
```

What is intentional: the 0% is not alarming — there is a positive message. The ⚠️ banner is the only real urgency flagged. The Priority Actions change dynamically based on what has been done.

---

### Dynamic nudges — The heart of onboarding

The Vault Integrity Score drives all nudges. Each tier unlocks a different message and adapted Priority Actions.

**0% — Empty vault**

```
Sidebar message   : "Your vault is empty. Start with a document."
Priority Action   : [➕ Add my first document]
Banner ⚠️         : "No trusted contact — vault inaccessible in an emergency"
```

**25% — First documents added**

```
Sidebar message   : "Good start. Add your medical directives."
Priority Action   : [🏥 Configure my Health Directives]
Banner ⚠️         : "No trusted contact — vault inaccessible in an emergency"
AI Suggestion     : "Would you like me to help you write
                     your medical directives? (5 min)"
```

**55% — Content well filled, no contacts yet**

```
Sidebar message   : "Invite your trusted contacts to
                     secure access to your vault."
Priority Action   : [👥 Invite my trusted contacts]
Banner ⚠️         : disappears as soon as the 1st contact confirms
Life Check banner : "Configure your Life Check to enable
                     full protection"
```

**70% — Contacts invited, Life Check not configured**

```
Sidebar message   : "Configure your Life Check to enable
                     automatic monitoring."
Priority Action   : [⏱️ Configure the Life Check]
AI Suggestion     : "Your vault is well filled but your protection
                     is not active yet. 3 minutes is enough."
```

**88% — Almost complete**

```
Sidebar message   : "Add your digital assets to unlock
                     premium recovery."
Priority Action   : [💎 Add my digital assets]
```

**97% — Complete vault**

```
Sidebar message   : "Protection nearly complete.
                     Test your emergency workflow."
Priority Action   : [🧪 Simulate an emergency]
```

---

### The Persistent Banner — The only real friction

Visible on all pages as long as no Trusted Contact has confirmed.

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️  Vault not protected in case of emergency                │
│     Without a trusted contact, no one can access            │
│     your vault if something happens to you.                 │
│     [Invite now]   [Remind me in 48h]                       │
└─────────────────────────────────────────────────────────────┘
```

After 48h without action, the reminder becomes more urgent:

```
┌─────────────────────────────────────────────────────────────┐
│ 🔴 Vault still unprotected — 48h without action             │
│    [Invite a contact now →]                                 │
└─────────────────────────────────────────────────────────────┘
```

---

### The AI Assistant — Contextual Guide

Accessible from the sidebar at any time. Never intrusive — it appears in two cases only.

**Case 1 — Proactive suggestion (after 3 min of inactivity on a complex page)**

```
┌────────────────────────────────────────────┐
│ 🤖 Assistant                               │
│                                            │
│ "I see you're on the Health               │
│  Directives. Would you like me to ask     │
│  a few questions to complete them?"        │
│                                            │
│  [Yes, let's go]   [No thanks]             │
└────────────────────────────────────────────┘
```

**Case 2 — Reply to a user question**

```
User      : "What is a trusted contact?"

Assistant : "A trusted contact is a person
             you designate to access your
             vault if something happens to you.
             You choose what they can see
             and under which conditions.
             Would you like to invite one now?"

             [Invite a contact →]   [Learn more]
```

The assistant knows the state of the user's vault and adapts its answers accordingly.

---

### In-App Documentation — "Explain on Demand" principle

No external documentation page. Each concept has a built-in explanation, accessible on click via an ℹ️ icon.

| Displayed term              | Tooltip on click                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Vault Integrity ℹ️          | "Score based on your vault's completeness and the number of active contacts."                                      |
| Zero-Knowledge ℹ️           | "Your data is encrypted locally. Neither Keeplas nor anyone can read it without your authorization."               |
| Dead Man Switch ℹ️          | "If you don't respond to your checks for X days, your designated contacts receive access according to your rules." |
| 3 of 5 contacts required ℹ️ | "To open your vault in an emergency, 3 of your 5 contacts must act together. None can do it alone."                |
| Heartbeat ℹ️                | "Silent signal detected automatically. As long as you use your device, no action is required."                     |

---

### Contextual Reminders in Settings

Important settings that are not configured appear directly in the relevant sections.

**Life Check page — if not configured**

```
┌─────────────────────────────────────────────────────────────┐
│ ⚡ Life Check not enabled                                    │
│    Your protection is not operational yet.                  │
│    [Configure in 3 minutes →]                              │
└─────────────────────────────────────────────────────────────┘
```

**Trusted Contacts page — if fewer than 3 contacts**

```
┌─────────────────────────────────────────────────────────────┐
│ ℹ️  You have 1 of 3 minimum recommended contacts            │
│    With 3 contacts, your vault can be recovered             │
│    even if one of them is unreachable.                      │
│    [Invite a second contact →]                             │
└─────────────────────────────────────────────────────────────┘
```

**Vault page — if Recovery Phrase not verified**

```
┌─────────────────────────────────────────────────────────────┐
│ 🔑 Recovery Phrase not confirmed                            │
│    If you lose access to this device, you won't be able     │
│    to recover your vault.                                   │
│    [Verify my Recovery Phrase →]                           │
└─────────────────────────────────────────────────────────────┘
```

---

### Typical full journey — First user

```
D0 — Sign-up
  → Recovery Phrase written down and verified (90 seconds)
  → Lands on dashboard — vault at 0%
  → Sees the Priority Actions
  → Adds a first document → vault at 15%
  → Closes the app

D1 — Natural return
  → Sees the ⚠️ missing-contact banner
  → Invites their spouse as the first contact
  → Vault at 30%
  → The assistant suggests Health Directives

D3 — Comes back to complete
  → Completes Health Directives with the assistant
  → Vault at 55%
  → Configures the Life Check (3 minutes)
  → Vault at 70%

D7 — Life Check notification
  → Validated automatically via passive signal (app opened)
  → No action required
  → Vault stays at 70%

D14 — Returns spontaneously
  → Sees the nudge "Add your digital assets"
  → Adds crypto wallet recovery seed
  → Vault at 85%

D30 — Vault well established
  → Life Check validated silently
  → Vault at 85-95%
  → Receives a suggestion to simulate an emergency
```

---

### What we do NOT have in the onboarding

```
❌ Presentation slides (skippable or not)
❌ Mandatory tutorial with overlay
❌ Onboarding checklist visible at all times
❌ Aggressive onboarding emails
❌ "Do you need help?" popup on load
❌ Technical jargon visible in the UI
❌ Premature information requests (phone, name)
❌ A funnel of 4 mandatory sessions
```

---

### Global UX rules

```
✓ The app explains the WHY before the WHAT at each step
✓ Simple vocabulary — "shard", "ZK", "Shamir" banned from the UI
✓ Score visible at all times as a natural motivator
✓ Automatic save on every action
✓ Everything resumes where you left off
✓ "Simulate an emergency" mode to test without consequences
✓ Explain on Demand via ℹ️ tooltips — never imposed
✓ The assistant responds, it does not push
```

---

## 13. Installation Scripts

### Philosophy

> A single file to get Keeplas running. The user never needs to understand the technical stack.

### Two levels of users

**Developers / Contributors**

```bash
git clone https://github.com/keeplas/keeplas.git
cd keeplas
cp .env.example .env
pnpm install
pnpm dev
```

**Self-hosting users**

```bash
curl -fsSL https://install.keeplas.com | bash
# or
docker compose up -d
```

### Execution order of `install.sh`

```
1. check_requirements     ← Docker, pnpm, Node.js
2. setup_env              ← Domain, admin email, local secret generation
3. setup-convex.sh        ← Convex Cloud or Self-hosted (interactive choice)
4. setup-crypto.sh        ← Noir/Barretenberg
5. start_services         ← Docker Compose
6. health-check.sh        ← Final check of all services
```

### Convex setup — two interactive modes

**Cloud mode**

```
→ The user goes to dashboard.convex.dev
→ Creates a "keeplas" project
→ Copies the URL and the deploy key
→ The script injects them into .env and deploys the functions automatically
```

**Self-hosted mode**

```
→ Launches the convex-local-backend container via Docker
→ Configures the port (default: 3210)
→ Deploys the Convex functions to the local instance
→ Checks that the service responds (health check with retry)
```

### Environment variables (`.env.example`)

```bash
# ================================
# KEEPLAS CONFIGURATION
# ================================

# App
DOMAIN=keeplas.yourdomain.com
NODE_ENV=production
ADMIN_EMAIL=admin@yourdomain.com

# Convex — filled automatically by setup-convex.sh
CONVEX_MODE=cloud             # "cloud" or "selfhosted"
CONVEX_URL=
CONVEX_DEPLOY_KEY=
CONVEX_PORT=3210              # Used only in selfhosted mode

# Encryption — generated automatically, DO NOT SHARE
ENCRYPTION_KEY=
ZK_CIRCUIT_PATH=./packages/crypto/zk/circuits

# Notifications — Life Check
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
WHATSAPP_API_KEY=             # Twilio or Meta API
TWILIO_SID=                   # IVR calls
TWILIO_TOKEN=

# Optional — Backup
BACKUP_ENABLED=false
BACKUP_S3_BUCKET=
BACKUP_S3_KEY=
BACKUP_S3_SECRET=
```

---

## 14. License & Governance

### License: AGPL v3 + CLA

**Why AGPL v3**

AGPL v3 is the most protective license for an open-source SaaS:

- If someone modifies the code and deploys it as a service, they must publish their modifications
- Maximum protection against competing commercial forks
- Well established legally — used by MongoDB, GitLab, Grafana
- Respected and understood by the open-source community

**Why the CLA on top**

The CLA (Contributor License Agreement) gives Keeplas Ltd the intellectual property of all external contributions. Mandatory clauses:

```
1. The contributor assigns all economic rights to Keeplas Ltd
2. Keeplas Ltd can relicense the code under any other license
3. Keeplas Ltd can sell or transfer these rights to a third party
```

**Open Core model**

```
AGPL v3          ← License of the public repo
CLA              ← Keeplas Ltd keeps full IP ownership
Keeplas Pro      ← Commercial license (SSO, audit logs, enterprise support)
```

### Impact on a possible acquisition

Thanks to the CLA, the founders own 100% of the IP, including external contributions. In case of an acquisition:

- The acquirer inherits all IP rights via the CLA
- They can change the license of future code
- They can commercialize without the AGPL constraint
- The open-source community is a value-adding asset, not a risk

**Important precaution**: the CLA must be drafted by an IP-specialized lawyer before the first external contributor.

---

## 15. Contribution Standards

### Contributor levels

| Level                 | Scope           | Prerequisites                      |
| --------------------- | --------------- | ---------------------------------- |
| **Contributor**       | UI, docs, tests | PR + standard review + signed CLA  |
| **Core Contributor**  | Convex, API     | Track record of merged PRs         |
| **Security Reviewer** | `/crypto` only  | Founders + external audit required |

### Non-negotiable technical standards

- **TypeScript strict mode** — no `any`, ever
- **ESLint + Prettier** — CI blocks on violation
- **Conventional Commits** — `feat:`, `fix:`, `security:`, `docs:`, `chore:`
- **Husky + lint-staged** — checked before each local commit
- **Mandatory crypto tests** — before any merge touching `/crypto`
- **No secrets in the code** — automatic detection via truffleHog

### GitHub templates

```
PULL_REQUEST_TEMPLATE.md:
  [ ] Tests added or updated
  [ ] No /crypto change without prior discussion in an issue
  [ ] CLA signed (first PR only)
  [ ] Documentation updated if necessary
  [ ] Conventional commit respected
```

### Vulnerability reporting

```
⚠️ DO NOT open a GitHub Issue for a security vulnerability.

Email: security@keeplas.com
Response time: 48h maximum
Encrypted channel: PGP key available on the site
```

---

## 16. Key Decisions Summary

### Stack & Architecture

| Topic           | Decision                         | Reason                                      |
| --------------- | -------------------------------- | ------------------------------------------- |
| Approach        | Web-first + PWA                  | Avoid React Native complexity at first      |
| UI Framework    | ShadCN + Tailwind                | Components in the repo, Next.js standard    |
| Backend         | Convex                           | Realtime, native TypeScript, self-hostable  |
| Auth            | Passkey (WebAuthn) + Convex Auth | Local biometrics, ZK-aligned, zero friction |
| Auth fallback   | Google / Apple / Email+pwd       | Maximum case coverage                       |
| Graph UI        | React Flow                       | Life Map central node                       |
| Package manager | pnpm                             | Performance, security, native monorepo      |
| Monorepo        | Turborepo                        | Clear app/crypto/ui separation              |
| Installation    | Bash script + Docker Compose     | One-command for users                       |
| Convex mode     | Cloud or Self-hosted             | Interactive choice at installation          |

### Security & License

| Topic            | Decision                    | Reason                                            |
| ---------------- | --------------------------- | ------------------------------------------------- |
| License          | AGPL v3 + CLA               | Max protection + possible acquisition + community |
| Crypto isolation | Separate `packages/crypto/` | Independent auditability                          |
| Crypto access    | Strict CODEOWNERS           | Founders only                                     |
| Secrets          | Generated locally           | Never transit through Keeplas servers             |
| Vulnerabilities  | Private email               | No public GitHub Issues                           |

### Product & UX

| Topic              | Decision                                           | Reason                                                         |
| ------------------ | -------------------------------------------------- | -------------------------------------------------------------- |
| Recovery           | Social (≥threshold contacts) + Recovery Phrase     | Double security with no server dependency                      |
| Shards             | Shamir threshold-of-5 (configurable, 2 by default) | User picks their security ↔ accessibility slider at onboarding |
| Shard distribution | ML-KEM-768 wrap per contact, fan-out on submission | Strict zero-knowledge — server never sees a shard in clear     |
| Life Check         | Passive First, Active Only If Needed               | Zero friction for the living user                              |
| Passive signals    | Score ≥ 50 pts = silent validation                 | Multi-source to avoid false positives                          |
| Passive signals    | Opt-in only, local processing                      | Privacy and transparency                                       |
| Frequency          | Configurable (weekly / monthly / quarterly)        | Adapted to each profile                                        |
| Quarterly          | All active channels mandatory                      | Maximum anti-false-positive                                    |
| Last check         | Displayed with signal type                         | Full transparency for the user                                 |
| Contacts view      | Status without signal detail                       | User privacy preserved                                         |
| Contact roles      | Trust (active, holds shard) + Recipient (passive)  | Simplified model — removed B1/B2/B3/B4 and First Responder     |
| Validation         | ≥threshold trust contacts confirm "unreachable"    | Fail-closed — without human confirmation, vault stays closed   |
| Grace period       | 72h after quorum reached                           | User can still cancel if they reappear                         |
| Onboarding         | Discover as You Go                                 | No funnel — score + nudges + assistant                         |
| Banner ⚠️          | Persistent until the 1st contact                   | The only real friction accepted                                |
| Explain on Demand  | ℹ️ tooltips everywhere                             | Built-in docs, never imposed                                   |
| Technical jargon   | Banned from the UI                                 | Accessibility for all profiles                                 |

---

_Document produced during the design sessions — Keeplas v1 — April 2026 — v5_
_Next step: Implementation of packages/crypto/ (Noir ZK circuits)_
