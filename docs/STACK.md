# Tech Stack & Decisions

This document records **what the Keeplas stack is** and **why each piece was chosen**. It is the reference for "should we add X?" conversations — measure new dependencies against the principles here before introducing them.

The guiding constraint behind every choice is the **zero-access / client-side encryption** model: the browser performs all cryptography and the server is blind in normal operation. That pushes the architecture toward a rich, trusted client, a thin verifiable server boundary, and a realtime backend that never sees plaintext.

---

## At a glance

| Layer         | Choice                                        | Version    |
| ------------- | --------------------------------------------- | ---------- |
| App framework | TanStack Start (on Vite)                      | `^1.168`   |
| Routing       | TanStack Router (file-based, type-safe)       | `^1.170`   |
| UI runtime    | React                                         | `19.2.4`   |
| Build tool    | Vite                                          | `^7.3`     |
| Styling       | Tailwind CSS v4 + shadcn/ui + Radix           | `^4`       |
| Backend / DB  | Convex (realtime functions + DB)              | `^1.35`    |
| Auth          | Convex Auth + `@auth/core` + WebAuthn         | `^0.0.91`  |
| Cryptography  | `@noble/post-quantum`, `hash-wasm`, WebCrypto | —          |
| Monorepo      | Turborepo + pnpm                              | pnpm 10.8+ |
| Language      | TypeScript                                    | `^5`       |
| Lint / format | ESLint 9 (flat config) + Prettier             | `^9`       |
| Tests         | Vitest                                        | `^4.1`     |
| Runtime       | Node                                          | `>= 20`    |

---

## Frontend

### TanStack Start (on Vite) — the app framework

The web app is a **single-page application** rendered client-side, served by a **lightweight server runtime** that handles request middleware and a couple of HTTP endpoints.

Why:

- **The app is inherently client-first.** Every authenticated surface depends on in-memory crypto state (the master key, derived keys) that only exists in the browser after unlock. There is no useful server-render of a vault screen — the server can't read the data. SPA mode matches this reality exactly: the server renders a static shell, the app hydrates and runs entirely on the client.
- **A real server runtime is still required**, not pure static hosting, because some security work must happen server-side on every request: setting the Content-Security-Policy, issuing the server-attested audit-context cookie (HMAC-signed IP/country that Convex re-verifies), and request-id correlation. TanStack Start gives us that runtime (`createStart` request middleware) without forcing server-rendering of the app.
- **Type-safe routing.** Routes, params, and search params are statically typed end-to-end via TanStack Router — fewer runtime "undefined param" classes of bug.
- **Vite-native.** Fast cold start and HMR, a standard plugin ecosystem, and a build that targets any Node host or a Nitro deployment preset (Vercel, Netlify, Cloudflare, self-host) — no hosting lock-in.

How it's organized:

- File-based routes live in `apps/web/src/routes/`. Route files are thin (`createFileRoute(...)({ component })`); screen implementations live under `apps/web/src/app/**`.
- Pathless layout routes (`_auth`, `_dashboard`, `_onboarding`, `_dashboard/settings`) hold the auth / onboarding guards.
- The server boundary is `apps/web/src/start.ts`.

### React 19

The UI runtime. Chosen for the ecosystem depth (Radix, TanStack, Convex's first-class React bindings) and the team's familiarity. The app uses React purely on the client; concurrent features and Suspense are used for data-loading boundaries (e.g. the vault list).

### Tailwind CSS v4 + shadcn/ui + Radix UI

- **Tailwind v4** for styling — utility-first, no runtime cost, design tokens declared inline via `@theme` (the "Digital Curator" design system: Vault Navy, Manrope + Inter, tonal layering, no 1px borders).
- **shadcn/ui pattern on Radix primitives** for every interactive component (dialogs, popovers, selects, etc.). We **do not** hand-roll interactive components — Radix gives us accessibility (focus management, ARIA, keyboard nav) for free, and the shadcn pattern keeps the components in-repo and themeable. Standardized on Radix; the few remaining Base UI components (Tooltip, DatePicker) are migrated when touched.

### Supporting libraries

- **Tiptap 3** — rich-text editor for vault content (letters, notes).
- **lucide-react** — icon set. **cmdk** — command palette.
- **Fontsource** (`@fontsource-variable/{inter,manrope,geist}`) — self-hosted variable fonts, no third-party font CDN (keeps `font-src 'self'` in the CSP and avoids a privacy leak).
- **libphonenumber-js** — phone parsing/validation for WhatsApp OTP.
- **qrcode.react**, **html2canvas-pro**, **jspdf** — Emergency Card rendering and PDF export, all client-side.
- **Preference-based i18n** (English / French) — a small custom context + JSON dictionaries (`en`/`fr`). The user's locale is a stored preference, not a URL segment, because the app is auth-gated and personal; there is no SEO surface to localize via routes.

---

## Backend

### Convex — realtime backend & database

Convex hosts the schema, queries, mutations, actions, and the realtime sync. Why Convex over a traditional DB + API tier:

- **Realtime by default.** Vault changes, Life Check countdowns, and trusted-contact state propagate to the client over a live subscription with no manual websocket/polling code.
- **End-to-end types.** Query/mutation signatures are generated and consumed directly by the React client — the API layer is the database layer, with no hand-written DTOs.
- **It fits the zero-access model.** Convex stores **ciphertext**. The server enforces authorization and integrity (auth gates, the mandatory `auditedMutation` wrapper, the audit hash-chain, rate limits) but never holds plaintext or any key that counts toward a recovery threshold.
- **Operational simplicity.** Managed cloud or self-hosted (`CONVEX_MODE=selfhosted`); function deploys are atomic and guarded (`pnpm deploy:convex`).

### Auth — Convex Auth + `@auth/core` + WebAuthn

- **Convex Auth** provides the session/auth foundation, integrated with the backend.
- **Password is pure authentication**, resettable via the 24-word recovery phrase — it is never the root secret. **No OAuth** (a third-party IdP can't be allowed to gate access to a zero-access vault).
- **`@simplewebauthn/{browser,server}`** — WebAuthn / Passkeys for phishing-resistant, biometric-local auth and per-device PRF-based unlock (PIN / biometric / hardware key).
- Sensitive flows enforce a **step-up gate** (login-OTP + TOTP) on top of the password.

### Messaging & payments

- **Resend** — transactional email (Life Check notices, OTP, contact form).
- **WhatsApp via Infobip** — OTP channel and Life Check liveness (a reply proves the user is alive). Login-critical for phone accounts.
- **`web-push` (VAPID)** — the Life Check push channel.
- **Stripe** — one-time hosted Checkout for the Lifetime plan; fulfillment via an idempotent webhook on the Convex side. No client-side Stripe.js (the browser never loads Stripe), so payments stay off the critical CSP/JS surface.

---

## Cryptography

All sensitive crypto lives in `packages/crypto/`, gated by CODEOWNERS and unit-tested. Invariants are enforced by `pnpm check:zk`.

- **`@noble/post-quantum`** — **ML-KEM-768** (NIST FIPS 203) wraps per-recipient DEKs and Shamir shards; **ML-DSA-65** (FIPS 204) signs each user's ML-KEM public key for authenticated key distribution (TOFU). Post-quantum chosen now to avoid a forced re-encryption later for long-lived "life continuity" data.
- **`hash-wasm`** — Argon2id KDF deriving the RootKey from the 24-word phrase. WASM-based for performance; the CSP allows `'wasm-unsafe-eval'` strictly for this.
- **WebCrypto AES-GCM** — content encryption, using the platform's audited primitives.
- **Shamir Secret Sharing** — social recovery: trusted contacts reconstruct the master key once the threshold is met. The server holds no shard that counts toward the threshold.

---

## Tooling

- **Turborepo + pnpm** — monorepo orchestration and caching. Apps: `apps/web`. Packages: `packages/convex` (`@keeplas/backend`), `packages/ui`, `packages/crypto` (restricted).
- **TypeScript 5** — strict mode across the workspace.
- **ESLint 9 (flat config)** + **Prettier** — linting and formatting. Generated files (`routeTree.gen.ts`, Convex `_generated/`) are excluded from formatting.
- **Vitest 4** — unit tests for the web app, backend functions, UI, and crypto primitives. Same Vite pipeline as the app, so tests run against the real module resolution.
- **Docker** (`Dockerfile.dev`) — optional reproducible dev environment pinned to CI's Node/pnpm versions.

---

## Security-relevant defaults

These are stack choices that exist specifically to protect the model:

- **Hash-based CSP.** The request middleware computes the SHA-256 of every inline `<script>` in each HTML response and emits `script-src 'self' <hashes> 'wasm-unsafe-eval'` — no `'unsafe-inline'`, no host-allowlisting of external script origins. Plus HSTS, `frame-ancestors 'none'`, `X-Content-Type-Options`, strict `Referrer-Policy`, and a locked-down `Permissions-Policy` (WebAuthn kept).
- **Server-attested audit context.** Every request gets a sealed, HMAC-signed `{ip, country, ts}` cookie that Convex re-verifies before writing the audit log — clients can't forge their own location.
- **Self-hosted fonts and no third-party script/style origins** keep the CSP tight and avoid privacy leaks.

---

## Adding a dependency — the bar

Before introducing a new library, check it against these (see `CLAUDE.md` for the full engineering principles):

1. **Does it touch the client crypto/security surface?** If yes, it needs founder review (CODEOWNERS) and must not widen the CSP.
2. **Is it used in ≥2 real places today?** If not, inline the logic instead.
3. **Does it duplicate something already in the stack?** Prefer the incumbent (e.g. Radix for interactive UI, Convex for any server state).
4. **Does it pull a runtime into the client bundle we don't need?** Prefer server-side (Convex action) or build-time alternatives.
