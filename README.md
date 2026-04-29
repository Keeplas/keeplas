# Keeplas

> Open-source **Life Continuity Platform** — securely store, organize, and transmit vital information to trusted contacts.

Keeplas helps users protect what matters: financial assets, medical directives, legal legacy, and trusted contacts — all encrypted client-side and transmitted only under conditions the user defines. No one (not even Keeplas) can read the vault without the user's consent.

- **Continuity** — your loved ones get access to vital info if you become incapacitated or pass away.
- **Security** — zero-knowledge architecture; secrets never leave the device unencrypted.
- **Control** — you decide who accesses what, when, and under which conditions.

License: **AGPL-3.0-only** + Contributor License Agreement. Self-hostable.

---

## Stack

- **Next.js 16 (App Router)** — web-first, PWA-ready
- **Convex** — realtime backend & DB (cloud or self-hosted)
- **Convex Auth + WebAuthn (Passkey)** — phishing-resistant, biometric-local auth
- **shadcn/ui + Radix + Tailwind v4** — design system
- **Post-quantum crypto** — ML-KEM-768 (NIST FIPS 203) wraps per-recipient DEKs and shards
- **Argon2id + AES-GCM + Shamir Secret Sharing** — key derivation and recovery
- **Turborepo + pnpm** — monorepo tooling

## Monorepo layout

```
apps/
  web/                  Next.js App Router app (PWA-ready)
packages/
  convex/               Convex schema, queries, mutations, actions  (@keeplas/backend)
  crypto/               Zero-knowledge crypto: AES, KDF, KEM, Shamir, recovery  (RESTRICTED)
  ui/                   Shared UI components built on Radix / shadcn pattern
PRD/                    Product specs, architecture recap, design wireframes
security/               Security policy and audit material
scripts/                Maintenance scripts
```

`packages/crypto/` is gated by **CODEOWNERS** — only founders can merge changes there.

## Requirements

- Node.js **>= 20**
- pnpm **>= 10** (`corepack enable` recommended)
- A Convex deployment (cloud or self-hosted) — see [Convex docs](https://docs.convex.dev)

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env template and fill values
cp .env.example .env.local

# 3. Provision Convex (creates a deployment, syncs schema)
npx convex dev

# 4. Run the dev server
pnpm dev
```

The web app runs at <http://localhost:3000>.

> Whenever you change anything under `packages/convex/`, run `npx convex dev` again to regenerate types and sync the deployment.

## Environment variables

All required variables are documented in [`.env.example`](./.env.example). High-level groups:

- **App** — `NEXT_PUBLIC_APP_URL`, `NODE_ENV`
- **Convex** — `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`
- **WebAuthn** — `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`
- **Audit context** — `KEEPLAS_CTX_SECRET` (HMAC; must be set in both web env and Convex env)
- **Email / Resend** — transactional email for Life Check & invitations
- **Web Push (VAPID)** & **WhatsApp Cloud API** — Life Check channels
- **Stripe** — payments

Generate the audit secret with `openssl rand -base64 32`. Set Convex-side variables with `npx convex env set <NAME> <VALUE>`.

## Scripts

| Command           | Description                                        |
| ----------------- | -------------------------------------------------- |
| `pnpm dev`        | Run all dev servers (Next.js, Convex) via Turborepo |
| `pnpm build`      | Production build for every workspace               |
| `pnpm lint`       | ESLint across the monorepo                         |
| `pnpm typecheck`  | TypeScript `--noEmit` across all packages          |
| `pnpm test`       | Run test suites (Vitest in `packages/crypto/`)     |
| `pnpm format`     | Prettier write on `**/*.{ts,tsx,js,jsx,json,css,md}` |
| `pnpm clean`      | Remove build artifacts (`dist`, `.next`, `.turbo`) |

## Security model

- **Master Key**, **Recovery Phrase (24 words)**, and **Shamir shards** never leave the client unencrypted.
- The **24-word phrase** is the root crypto secret (Argon2id-derived). The **password is pure auth** and is resettable via the 24 words.
- **No OAuth.** No direct phrase recovery — only trusted contacts (Shamir threshold) can rebuild it.
- Per-device unlock combines **PIN**, **biometric (PRF)**, and **hardware key (PRF)** — RootKey wraps live in IndexedDB; the 24-word phrase is requested on first login per device.
- All sensitive cryptography is implemented in [`packages/crypto/`](./packages/crypto), gated by CODEOWNERS and unit-tested.

Report vulnerabilities to **security@keeplas.com** — see [SECURITY.md](./SECURITY.md). Do **not** open a public GitHub issue.

## Documentation

- [`PRD/keeplas-architecture-recap-v5.md`](./PRD/keeplas-architecture-recap-v5.md) — full architecture, security & product decisions
- [`PRD/keeplas-convex-zk-technical-v2.md`](./PRD/keeplas-convex-zk-technical-v2.md) — Convex + zero-knowledge technical spec
- [`PRD/IMPLEMENTATION_PLAN.md`](./PRD/IMPLEMENTATION_PLAN.md) — implementation roadmap
- [`PRD/Design/`](./PRD/Design) — wireframes and design tokens
- [`CLAUDE.md`](./CLAUDE.md) — engineering conventions for AI assistants & humans

## Contributing

We welcome contributions! Please read:

- [CONTRIBUTING.md](./CONTRIBUTING.md) — workflow and code style
- [CONTRIBUTOR_LICENSE_AGREEMENT.md](./CONTRIBUTOR_LICENSE_AGREEMENT.md) — required CLA
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

Restricted areas (founder approval required): `packages/crypto/`, `security/`.

## License

Keeplas is licensed under the **GNU AGPL v3.0** — see [`license.md`](./license.md). Contributors agree to the [CLA](./CONTRIBUTOR_LICENSE_AGREEMENT.md) so the project can evolve under a sustainable governance model.
