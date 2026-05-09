# CLAUDE.md — Keeplas Engineering Conventions

This file is loaded by Claude Code (and similar AI assistants) on every session in this repo. Keep it terse and authoritative — treat it as code: review changes via PR.

## Quick Reference

| Item            | Value                                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| Package manager | **pnpm 10.8.1+** (Node ≥20)                                                      |
| Web app         | http://localhost:3000 (Next.js 16, Turbopack)                                    |
| Convex dev URL  | set via `NEXT_PUBLIC_CONVEX_URL`                                                 |
| Stack           | Next.js 16 • React 19 • Convex • shadcn/Radix • Tailwind v4 • ESLint • Turborepo |

## Essential Commands

```bash
# Dev
pnpm dev                # Run all apps via Turbo
npx convex dev          # Regen Convex types — REQUIRED after editing packages/convex/

# Quality
pnpm lint               # ESLint across workspace
pnpm typecheck          # tsc --noEmit across workspace
pnpm format             # Prettier on **/*.{ts,tsx,js,jsx,json,css,md}

# Build / clean
pnpm build              # Turbo build
pnpm clean              # Clear .next / .turbo / node_modules

# Env
pnpm check:env          # Validate .env (runs as predev/prebuild)
pnpm sync:convex-env    # Push env vars to Convex deployment
pnpm link:env           # Symlink .env files across workspaces
```

## Code & comments

- Comments and docs in English (app is in English by default).
- Reference and update `.env.example` when adding new credentials or environment variables. Never commit secrets.

## Engineering principles

### SOLID, DRY, YAGNI, KISS — verifiable checks

Apply these on every diff. If a check fails, fix it before submitting.

- **DRY** — Before adding a component / hook / util, grep for an existing one with the same shape. Tolerate 2 near-duplicates; on the 3rd occurrence, extract. When extracting, the abstraction must serve ≥2 real call sites today (not hypothetical).
- **KISS** — No wrapper that only forwards props. No prop / option with a single call site. Prefer inline over abstraction when used in 1–2 places. A clear 10-line block beats a clever 3-line one-liner.
- **YAGNI** — No "future-proofing": no feature flags, options, or code paths for needs that don't exist today. No backwards-compat shims when a full refactor is cheaper. No error handling for impossible scenarios (trust internal callers; validate only at system boundaries).
- **SOLID (S + D)** — One reason to change per component. Pass behavior via props / callbacks / slots, not via internal `if (variant === ...)` branching. Depend on interfaces (Convex query/mutation types, Radix primitives), not concrete implementations.

### Pre-submit checklist

Before sending a diff, mentally run:

1. "If I delete this line / file / prop, what breaks?" — if nothing, delete it.
2. "Is this abstraction used in ≥2 places today?" — if no, inline it.
3. "Does this duplicate something that already exists?" — grep first, extract second.
4. "Did I add anything the task didn't ask for?" — remove it.

### Verifiable success criterion (bug fix / refactor / multi-step)

Before coding, turn the request into a check:

- **Bug** → write a failing test that reproduces it, then make it pass.
- **Refactor** → tests green before AND after; the diff changes only what was asked.
- **Multi-step task** → list `[step] → verify: [check]` upfront, then execute step by step.

### Feature scoping

Don't ship parallel pages for overlapping features — favor variants / categories when the data model overlaps.

## Monorepo & tooling

- Turborepo + pnpm. Apps: `apps/web` (Next.js App Router). Packages: `packages/crypto` (RESTRICTED — founders only via CODEOWNERS), `packages/convex`, `packages/ui`.
- After editing anything under `packages/convex/`, run `npx convex dev` to regenerate types and sync the deployment.

## UI / design system

- All interactive components must use the **shadcn/ui** pattern with Radix UI primitives. Do not write custom interactive components.
- Follow `PRD/Design/` wireframes for exact tokens (radius, colors, fonts). Brand: editorial "Digital Curator" — Manrope + Inter, Vault Navy `#041632`, no 1px borders, tonal layering.
- Standardize on Radix. Tooltip and DatePicker still use Base UI — migrate them when touched.

## Security model (zero-knowledge)

- Master Key, Recovery Phrase (24 words), and Shamir shards NEVER leave the client unencrypted.
- 24 words = root crypto secret (Argon2id-derived). Password is pure auth (resettable via 24 words). No OAuth. No direct phrase recovery — trusted contacts only.
- Per-device unlock: PIN, Biometric (PRF), Hardware key (PRF) coexist via local RootKey wraps in IndexedDB; the 24-word phrase is required on first login per device.
- Post-quantum: ML-KEM-768 (NIST FIPS 203) wraps per-recipient DEKs and shards. Replaces RSA-OAEP.
- Sensitive crypto code lives in `packages/crypto/` and is gated by CODEOWNERS.
