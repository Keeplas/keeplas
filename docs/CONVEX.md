# Convex workflow

Keeplas uses [Convex](https://convex.dev) as its realtime backend and database. Every contributor needs their **own** Convex deployment for local development — there is no shared dev deployment.

This guide covers: provisioning, daily workflow, schema changes, env-var management, the JWT chicken-and-egg, deployment, and `cloud` vs `selfhosted` modes.

## TL;DR — first-time setup

```bash
# 1. After `pnpm bootstrap` finishes:
openssl rand -base64 32                          # copy output into KEEPLAS_CTX_SECRET in .env.local

# 2. Provision your personal Convex deployment (opens a browser)
npx convex dev --once --configure=new
#    → writes CONVEX_DEPLOYMENT + NEXT_PUBLIC_CONVEX_URL into .env.local

# 3. Seed Convex Auth JWT keys on the deployment (one-time)
npx @convex-dev/auth                             # generates JWT_PRIVATE_KEY + JWKS on Convex

# 4. Push the rest of your local env to Convex
pnpm sync:convex-env                             # KEEPLAS_CTX_SECRET, WEBAUTHN_*, RESEND_*, etc.

# 5. Verify
pnpm check:convex                                # should be green

# 6. Boot the app
pnpm dev                                         # Next.js + `convex dev` in parallel
```

After this, `pnpm dev` is your only command — it spawns the Next.js server and `convex dev` in parallel and runs the background env-drift check.

## Why each contributor needs their own deployment

The Convex deployment stores the user's vault ciphertext, audit logs, trusted contacts, scenarios — everything. A shared dev deployment would either leak data between contributors or require fragile multi-tenant isolation. Convex's free tier covers a personal dev deployment easily.

## Deployment modes — cloud, local (BETA), self-hosted

Set via `CONVEX_MODE` in `.env.local` (this is a Keeplas-side hint; the Convex CLI itself reads `CONVEX_DEPLOYMENT`).

| Mode               | What it means                                                        | Trade-offs                                                                                |
| ------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **`cloud`**        | Deployment hosted at `convex.cloud` (free tier covers personal dev). | Easiest. Default for `pnpm bootstrap`. Internet required.                                 |
| **`local` (BETA)** | Convex backend binary running on `http://127.0.0.1:3210`.            | Offline-friendly. State stored under `~/.convex/`. See gotcha below.                      |
| **`selfhosted`**   | Self-hosted Convex backend (Docker / VM).                            | Production self-hosters. See [Convex self-hosting](https://docs.convex.dev/self-hosting). |

You're asked to pick during `npx convex dev --once --configure=new`. Most contributors should pick **cloud**. Pick **local** if you genuinely want offline dev or are debugging Convex itself.

> **Local-deployment caveat.** Local deployments register state against the project root path. Earlier Keeplas versions ran `convex dev` from `packages/convex/` via turbo, which couldn't find that registration. `scripts/dev-with-convex-check.mjs` now spawns `convex dev` from the repo root, so `pnpm dev` works for both cloud and local. If you ever invoke convex directly, do it from the repo root — never from `packages/convex/`.

## Daily workflow

### When you only edit web code (`apps/web/`)

Just `pnpm dev`. The Convex background check warns on drift; the Next.js dev server hot-reloads. You don't need to run `convex dev` unless you've changed schema or backend functions.

### When you edit Convex code (`packages/convex/`)

`pnpm dev` already runs `convex dev` in parallel with the Next.js server — saving a `schema.ts` or query/mutation re-publishes within 1–2 seconds and regenerates `packages/convex/_generated/`. You only need a second terminal for `npx convex dev` if you've stopped the dev stack for some reason.

If `convex dev` is _not_ running while you edit `packages/convex/`, the web app will be talking to a stale function bundle on the server and TypeScript will drift from the schema.

### When you edit env vars

- **Local-only var (web side)**: edit `.env.local`, restart `pnpm dev`. No sync needed.
- **Server-side var (Convex needs it)**: edit `.env.local` (or `.env.convex.local` for backend-only vars), then `pnpm sync:convex-env`.
- **Check drift**: `pnpm check:convex` does a one-shot validation against the deployment. It also fires automatically in the background during `pnpm dev`.

`scripts/_env-keys.mjs` is the single source of truth for which vars belong on which side.

## Schema & function changes

Schema lives in [`packages/convex/schema.ts`](../packages/convex/schema.ts). After editing:

1. Make sure `npx convex dev` is running. It auto-pushes the new schema.
2. Convex will reject the push if existing data violates the new schema — fix the migration before committing.
3. Reload the web app — `_generated/` types update, TypeScript surfaces any callsite drift.
4. If you renamed/removed a field, write a migration in [`packages/convex/migrations.ts`](../packages/convex/migrations.ts) before the schema change lands on `main`.

> The directory **does not regenerate** `packages/convex/convex/_generated/` correctly when you run `convex dev` from `packages/convex/`. That's a known structural quirk — `.gitignore` ignores the stale path. The fix (per-package `convex.json`) is on the follow-up list.

## Seeding the auth keys — `npx @convex-dev/auth`

`@convex-dev/auth` (Convex Auth) needs two env vars on the deployment to sign and verify session tokens:

- `JWKS` — public key set
- `JWT_PRIVATE_KEY` — signing key

**These are NOT auto-generated.** Convex Auth's `requireEnv('JWT_PRIVATE_KEY')` throws on first sign-in if the key is missing. You generate them once per deployment with:

```bash
npx @convex-dev/auth
```

The CLI generates a fresh keypair and writes both values to your deployment's env vars via the Convex CLI. The full setup procedure it runs is documented at <https://labs.convex.dev/auth/setup/manual>.

We do **not** push these two keys via `pnpm sync:convex-env` — they're omitted from `CONVEX_SYNC_KEYS` in [`scripts/_env-keys.mjs`](../scripts/_env-keys.mjs) so they stay unique per deployment and re-syncs never invalidate existing sessions.

> A previous version of this doc described a "Better Auth chicken-and-egg" where keys auto-generated on first sign-in. That was wrong — that's how the separate Better Auth library behaves, not Convex Auth (`@convex-dev/auth`), which is what this codebase uses.

## The audit HMAC secret

`KEEPLAS_CTX_SECRET` must be the **exact same value** in your `.env.local` AND on the Convex deployment. The middleware HMAC-signs every request's IP+country envelope; Convex re-verifies. Mismatch → every audited mutation fails with `Invalid audit context`.

- Generate once: `openssl rand -base64 32` → paste into `.env.local`.
- Push to Convex: `pnpm sync:convex-env`.
- Verify match: `pnpm check:convex` (this is the keystone check — `mustMatchLocal: true` in `scripts/_env-keys.mjs`).

## Deployment

`packages/convex/package.json` exposes two commands:

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npx convex dev`    | Push to your dev deployment, watch for changes. |
| `npx convex deploy` | Push to your prod deployment.                   |

For Keeplas the prod deployment is provisioned and managed by the founders — community contributors should never need `convex deploy`. If you do (e.g. self-hosting your own fork), set `CONVEX_DEPLOY_KEY` from the [Convex dashboard](https://dashboard.convex.dev) and run `npx convex deploy --prod`.

## Common gotchas

- **`Invalid audit context` on every mutation.** → `KEEPLAS_CTX_SECRET` on Convex doesn't match the one in `.env.local`. Re-run `pnpm sync:convex-env`.
- **TypeScript can't find `api.foo`.** → `packages/convex/_generated/` is stale. Run `npx convex dev` to regenerate.
- **Sign-in throws `Missing environment variable JWT_PRIVATE_KEY`.** → JWT keys not seeded. Run `npx @convex-dev/auth` once.
- **`pnpm check:convex` says JWKS / JWT_PRIVATE_KEY missing.** → Same as above — run `npx @convex-dev/auth`.
- **`packages/convex/convex/_generated/` keeps reappearing.** → Known quirk (per-package `convex.json` missing). It's gitignored; ignore it. The fix is tracked.
- **Lost track of your deployment URL.** → `npx convex dashboard` opens it in the browser.

## Useful Convex CLI commands

| Command                              | Use                                                      |
| ------------------------------------ | -------------------------------------------------------- |
| `npx convex dev`                     | Watch + push functions to dev deployment.                |
| `npx convex dev --once`              | One-shot push (no watch).                                |
| `npx convex env list`                | List env vars on your deployment.                        |
| `npx convex env set KEY value`       | Set an env var directly (prefer `pnpm sync:convex-env`). |
| `npx convex logs`                    | Tail server function logs.                               |
| `npx convex dashboard`               | Open the Convex web dashboard.                           |
| `npx convex run module:fn '{"a":1}'` | Invoke a function from the CLI.                          |
| `npx convex data <table>`            | Inspect table rows.                                      |
