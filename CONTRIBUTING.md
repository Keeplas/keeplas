# Contributing to Keeplas

Thank you for your interest in contributing to Keeplas! This guide will help you get started.

## Getting Started (Docker — recommended)

The project ships a `docker-compose.yml` that pins Node 22 and pnpm 10.8.1, so you don't need to install anything locally except Docker.

**Prerequisite:** Docker Desktop (or Docker Engine + Compose v2).

1. Fork the repository and clone your fork:
   `git clone https://github.com/YOUR_USERNAME/keeplas.git && cd keeplas`
2. Copy the env template and fill the audit secret:
   `cp .env.example .env.local`
   Then set `KEEPLAS_CTX_SECRET` to the output of `openssl rand -base64 32`.
3. **First time only** — create your personal Convex deployment (interactive, opens a browser):
   `docker compose run --rm app npx convex dev --once --configure=new`
   This populates `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` in the root `.env.local`.
4. Consolidate the env files into a single source of truth:
   `docker compose run --rm app pnpm link:env`
   This symlinks `apps/web/.env.local` and `packages/convex/.env.local` to the root `.env.local`. From now on you only edit the root file.
5. Push your secrets to your Convex deployment:
   `docker compose run --rm app pnpm sync:convex-env`
6. Start the stack:
   `docker compose up`
7. Open http://localhost:3000

**Useful commands**
- `docker compose exec app pnpm test` — run tests
- `docker compose exec app pnpm lint && docker compose exec app pnpm typecheck` — lint & types
- `docker compose exec app pnpm check:env` — validate `.env.local` is complete
- `docker compose down -v` — full reset (drops the `node_modules` volumes — next `up` re-installs)

## Getting Started (native, fallback)

If you prefer to run on the host without Docker:

1. Install Node 22 (see `.nvmrc`) and pnpm 10.8.1 (`corepack enable`).
2. `pnpm install`
3. `cp .env.example .env.local` and set `KEEPLAS_CTX_SECRET` (`openssl rand -base64 32`).
4. `npx convex dev --once --configure=new` — provisions your Convex deployment.
5. `pnpm link:env` — symlinks `apps/web/.env.local` and `packages/convex/.env.local` to the root `.env.local` (single source of truth).
6. `pnpm sync:convex-env` — pushes secrets to Convex.
7. `pnpm dev`

## Development Workflow

1. Create a branch from `main`: `git checkout -b feature/your-feature`
2. Make your changes
3. Run checks: `pnpm lint && pnpm typecheck && pnpm test`
4. Commit with a clear message
5. Push and open a Pull Request

## Code Style

- TypeScript strict mode
- ESLint + Prettier for formatting
- No `any` types — use proper typing
- Comments in English

## Restricted Areas

The following directories require founder approval and cannot be modified by community contributors:

- `packages/crypto/` — Zero-knowledge and encryption code (security-critical)
- `security/` — Audit reports

See `CODEOWNERS` for details.

## Contributor License Agreement

By submitting a pull request, you agree to the terms of our [CLA](CONTRIBUTOR_LICENSE_AGREEMENT.md). This ensures Keeplas Ltd retains the ability to maintain and evolve the project.

## Reporting Security Issues

**Do NOT open a GitHub issue for security vulnerabilities.**

Email: security@keeplas.com

See [SECURITY.md](SECURITY.md) for details.

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.
