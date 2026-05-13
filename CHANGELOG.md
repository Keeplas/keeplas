# Changelog

All notable changes to Keeplas are recorded here.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project (loosely) follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). For the release procedure, see [`docs/RELEASE_PROCESS.md`](./docs/RELEASE_PROCESS.md).

## [Unreleased]

### Added

- One-command contributor bootstrap: `pnpm setup` copies `.env.local`, installs deps, links per-package env files, and prints the manual Convex steps.
- Non-blocking Convex env check on `pnpm dev` — the 30s `npx convex env list` round-trip now runs in the background and warns on drift without blocking the dev server.
- `.env.local.example` with local-safe defaults (localhost URLs, dev WebAuthn config).
- `.editorconfig` and `.vscode/{settings,extensions}.json` for consistent editor behavior across contributors.
- `ARCHITECTURE.md` describing the audit envelope flow, package boundaries, and crypto-package isolation.
- `CHANGELOG.md` (this file) and `docs/RELEASE_PROCESS.md`.

### Changed

- `predev`/`prebuild` now run only the fast local env check; the slow Convex round-trip moved to a manual `pnpm check:convex` (also fires asynchronously during `pnpm dev`).
- Patch-bumped `next` and `eslint-config-next` to `16.2.6`, clearing 13 of the previous 24 security advisories.
- React Compiler rules (`set-state-in-effect`, `purity`, `immutability`) downgraded from error → warn in `apps/web` while pre-existing violations are addressed incrementally.

### Removed

- Stray `apps/web/.env copy.local` duplicate.
- Stale `packages/convex/convex/_generated/` directory (the live codegen output stays at `packages/convex/_generated/`).
