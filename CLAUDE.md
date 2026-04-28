# CLAUDE.md — Keeplas Engineering Conventions

This file is loaded by Claude Code (and similar AI assistants) on every session in this repo. Keep it terse and authoritative — treat it as code: review changes via PR.

## Code & comments
- Comments and docs in English (app is in English by default).
- Reference and update `.env.example` when adding new credentials or environment variables. Never commit secrets.

## Engineering principles
- Respect SOLID, DRY, YAGNI, KISS. Never duplicate logic — extract abstractions only when they earn their keep (no premature generalization).
- Before coding a bug fix or refactor, turn the request into a verifiable success criterion:
  - Bug → write a failing test that reproduces it, then make it pass.
  - Refactor → tests green before AND after; the diff should change only what was asked.
  - Multi-step task → list `[step] → verify: [check]` upfront, then execute step by step.
- Don't ship parallel pages for overlapping features — favor variants/categories when the data model overlaps.

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
