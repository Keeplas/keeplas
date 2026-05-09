# Testing Strategy

What we test, how we split unit vs end-to-end, and where the line is for a
zero-knowledge product. Keep this short and authoritative — when in doubt,
match what's already in the repo.

## Principles

1. **Cover the security invariants first.** Anything that protects the master
   key, recovery phrase, shards, or vault contents is non-negotiable. Bug fixes
   and refactors in those areas start with a failing test (per `CLAUDE.md`).
2. **Test the contract, not the implementation.** Convex query/mutation handlers
   are tested through their public signature; React components through their
   rendered DOM and user-visible behaviour.
3. **Don't test third-party code.** Trust Convex, Radix, Next.js, and the Web
   Crypto API. Test our wiring around them.

## What goes in unit tests

Use these for fast, isolated logic. Co-locate as `*.test.ts` next to the file.

- **Pure functions and validators**: `apps/web/src/lib/parse-recovery-phrase.ts`,
  `format.ts`, `link-payload.ts`, anything in `@keeplas/crypto` exposed to the
  app.
- **Hooks with deterministic state**: timers, signal aggregators
  (`use-passive-signal`), local-storage backed state
  (`use-local-storage-state`).
- **Convex validators / `validators.ts`**: every Zod-equivalent
  `v.object({...})` schema gets at least one valid + one invalid case.
- **Convex domain logic** that does not touch storage: scoring, filtering,
  status derivation. Mock the database surface only when unavoidable; prefer
  passing inputs in directly.
- **Crypto wrappers** in `packages/crypto/`: round-trip tests (encrypt then
  decrypt, wrap then unwrap), known-answer tests against published vectors.

## What goes in end-to-end tests

Use Playwright (when introduced) for anything where the browser is part of the
contract — IndexedDB, WebAuthn, real Convex round-trips, real cookies.

- **Onboarding** — sign-up, recovery-phrase generation, first device unlock
  enrollment.
- **Login + device unlock** — PIN, biometric (PRF), hardware key (PRF) on a
  fresh and a returning device.
- **Vault item create / view / share** — including the upload queue
  (`upload-queue.tsx`) and decryption on read.
- **Trusted-contacts shard distribution** — invite, accept, distribute,
  resubmit.
- **Recovery flow** — quorum, 72-hour grace window, cancellation, vault
  unlock by recipient.
- **Life Check** — passive signal stalling, escalation, cancellation.

## What we deliberately don't test

- Visual regressions of marketing copy or icons.
- Internals of `@keeplas/ui` shadcn re-exports (those are tested upstream by
  shadcn / Radix).
- The Convex generated client (`_generated/`).

## Where to put each kind of test

| Kind              | Location                           | Runner                      |
| ----------------- | ---------------------------------- | --------------------------- |
| Pure utility      | `apps/web/src/lib/<file>.test.ts`  | (TBD — vitest recommended)  |
| Convex unit       | `packages/convex/<domain>.test.ts` | Convex test runner / vitest |
| Crypto round-trip | `packages/crypto/<module>.test.ts` | vitest                      |
| End-to-end        | `apps/web/e2e/<flow>.spec.ts`      | Playwright                  |

If a test would need to mock Convex auth, IndexedDB, WebAuthn, or `crypto.subtle`
extensively to run as a unit test, promote it to E2E instead — the mocks become
the bug surface.

## Coverage goals

No hard CI gate yet. Target:

- 100% on `parse-recovery-phrase.ts`, every crypto wrapper, every Convex
  validator.
- ≥80% on Convex domain files (`trusted_contacts.ts`, `vaults.ts`,
  `vault_items.ts`, `release.ts`, `life_check.ts`).
- E2E covering every workflow listed above before any production cutover.

When you change a file under those targets, write or update the test in the
same PR. Refactors must keep tests green before AND after.

## Writing a test for a security-sensitive path

Follow this order:

1. **Reproduce the threat as a failing test.** If you're fixing a bug where a
   shard could be read in plaintext, write a test that asserts the plaintext is
   never observable through the API surface.
2. **Make it pass with the smallest change.** Resist the temptation to
   refactor adjacent code in the same diff.
3. **Add a regression note** in the test name itself, e.g.
   `it("never returns the unwrapped key when accessLevel is set to public")`.
   The name is the documentation; future readers shouldn't have to guess why
   the test exists.
