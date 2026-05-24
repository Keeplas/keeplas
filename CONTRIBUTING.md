# Contributing to Keeplas

Thank you for your interest in contributing! For the system overview, read [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) first.

## First-time setup

The fast path is **native** with `pnpm bootstrap`. Docker is supported as an alternative.

### Native (recommended)

**Prerequisites:** Node 22 (see [`.nvmrc`](./.nvmrc)) and pnpm ≥ 10.8.1 (`corepack enable`).

1. Fork and clone:
   `git clone https://github.com/YOUR_USERNAME/keeplas.git && cd keeplas`
2. **One-command bootstrap:**
   `pnpm bootstrap`
   Copies `.env.local.example` → `.env.local`, installs, links per-package envs, prints the next steps.
   _Note:_ this script is intentionally **not** named `setup` — `pnpm setup` is a reserved pnpm built-in that configures your shell's `PNPM_HOME`.
3. Open `.env.local` and paste a freshly generated audit secret in `KEEPLAS_CTX_SECRET`:
   `openssl rand -base64 32`
4. Provision your personal Convex deployment (interactive — opens a browser):
   `npx convex dev --once --configure=new`
   This writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` into `.env.local`.
5. Seed Convex Auth's JWT keys on your deployment (one-time):
   `npx @convex-dev/auth`
   Generates a unique `JWT_PRIVATE_KEY` + `JWKS` pair and sets them on your deployment via the Convex CLI. Without this, the very first sign-in throws `Missing environment variable JWT_PRIVATE_KEY`.
6. Push the rest of your local env to Convex:
   `pnpm sync:convex-env`
   Pushes the audit secret, WebAuthn config, and Resend keys. `JWKS` / `JWT_PRIVATE_KEY` are deliberately **not** pushed by this script (they're per-deployment unique, seeded by step 5).
7. Boot the app:
   `pnpm dev`
   The Convex env check runs in the background and warns on drift without blocking boot. Pre-push, run `pnpm check:convex` for a hard check.

> **Windows:** `pnpm link:env` uses POSIX symlinks. Enable Windows Developer Mode (Settings → Privacy → For developers) or run your shell as administrator the first time — afterward, the symlinks persist.

### Docker (alternative)

`docker-compose.yml` pins Node 22 and pnpm 10.8.1 for fresh-machine onboarding or CI-parity debugging. Steps mirror the native path; full workflow including `compose exec`, `compose run`, and gotchas: [`docs/DOCKER.md`](./docs/DOCKER.md).

### Convex deep dive

The first run requires seeding `JWT_PRIVATE_KEY` + `JWKS` on your deployment via `npx @convex-dev/auth`. Every key concept — provisioning, schema changes, env sync, audit secret matching, the `cloud` vs `selfhosted` modes — is documented in [`docs/CONVEX.md`](./docs/CONVEX.md). Read it once before you touch `packages/convex/`.

## Development workflow

1. Branch from `main`: `git checkout -b feature/your-feature` (or `fix/…`, `docs/…`, `chore/…`).
2. Make changes. Commit often, with clear messages — see [keep-a-changelog categories](./CHANGELOG.md) for the verbs we use.
3. Run checks locally: `pnpm lint && pnpm typecheck && pnpm test`.
4. Push and open a PR. CI runs the same checks plus `pnpm audit`.

## Troubleshooting

### "Module factory is not available" / runtime error mentioning an old dep version

After pulling main (especially across a dep bump), you may see something like:

```
Module [...]/next@16.2.3/[...] was instantiated [...] but the module factory is not available
```

…even though the lockfile has been at `16.2.6` for a while. This happens because pnpm's content-addressable store keeps every version of a dep across upgrades, and Turbopack's `.next/` cache may reference the old path.

**Fix:**

```bash
pnpm reset
```

This wipes every `node_modules`, `.next`, and `.turbo` under the repo and reinstalls from the current lockfile. Then hard-reload the browser (Cmd+Shift+R) or open the page in a private window to bypass cached client chunks.

### `pnpm setup` modifies your shell profile and does nothing

`pnpm setup` is a reserved pnpm built-in that configures `PNPM_HOME` — it's not our bootstrap script. Use `pnpm bootstrap` instead.

### `pnpm check:convex` complains about `JWKS` / `JWT_PRIVATE_KEY` missing

Expected on a fresh Convex deployment. Convex Auth (`@convex-dev/auth`) does **not** auto-generate them — the first sign-in throws `Missing environment variable JWT_PRIVATE_KEY` if you skip this. Seed them once with `npx @convex-dev/auth`, then re-run `pnpm check:convex`.

## Issue labels

We use a flat label scheme so newcomers can find work fast:

- `good-first-issue` — small, well-scoped, no domain context required.
- `help-wanted` — open contributions welcomed.
- `area:web` — `apps/web/` (Next.js, UI, hooks, middleware).
- `area:convex` — `packages/convex/` (schema, queries, mutations, actions).
- `area:crypto` — `packages/crypto/` (**founder-approved only** — see Restricted Areas).
- `area:ui` — `packages/ui/` design system.
- `area:docs` — README, CONTRIBUTING, ARCHITECTURE, inline docs.

## Code style

- TypeScript strict mode. No `any` — use `unknown` + narrowing.
- ESLint + Prettier enforce style. Pre-commit hook runs `lint-staged`.
- Comments in English, only when the _why_ is non-obvious.
- Don't pre-abstract — three similar lines beats an abstraction with one caller.

## Restricted areas

The following directories require founder approval (CODEOWNERS):

- `packages/crypto/` — zero-knowledge primitives.
- `security/` — audit reports and threat models.

PRs touching these will be tagged `needs-founder-review`.

## Contributor License Agreement

By submitting a pull request, you agree to the terms of our [CLA](CONTRIBUTOR_LICENSE_AGREEMENT.md). This ensures Keeplas Ltd retains the ability to maintain and evolve the project.

## Reporting Security Issues

**Do NOT open a GitHub issue for security vulnerabilities.**

Email: security@keeplas.com

See [SECURITY.md](SECURITY.md) for details.

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.
