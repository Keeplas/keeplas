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

# 3. Bootstrap auth keys (one-time chicken-and-egg)
pnpm dev                                         # boot the app
# open http://localhost:3000 and sign in once    # triggers Better Auth JWT keygen on Convex
pnpm sync:convex-env                             # push the rest of your local env to Convex

# 4. Verify
pnpm check:convex                                # should be green
```

After this, the only commands you'll routinely use are `pnpm dev` and `npx convex dev` (when changing schema/functions).

## Why each contributor needs their own deployment

The Convex deployment stores the user's vault ciphertext, audit logs, trusted contacts, scenarios — everything. A shared dev deployment would either leak data between contributors or require fragile multi-tenant isolation. Convex's free tier covers a personal dev deployment easily.

## The two configuration paths — cloud vs selfhosted

Set via `CONVEX_MODE` in `.env.local`:

| Mode         | What it means                                        | Who uses it                        |
| ------------ | ---------------------------------------------------- | ---------------------------------- |
| `cloud`      | Talk to a deployment hosted at `convex.cloud`.       | **Default for all contributors.**  |
| `selfhosted` | Talk to a self-hosted Convex backend (Docker or VM). | Advanced users, prod self-hosters. |

`cloud` mode is what `pnpm bootstrap` configures and what these docs assume. For `selfhosted`, see [Convex self-hosting docs](https://docs.convex.dev/self-hosting) — you'll set `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT` manually.

## Daily workflow

### When you only edit web code (`apps/web/`)

Just `pnpm dev`. The Convex background check warns on drift; the Next.js dev server hot-reloads. You don't need to run `convex dev` unless you've changed schema or backend functions.

### When you edit Convex code (`packages/convex/`)

In a second terminal, run:

```bash
npx convex dev
```

It watches `packages/convex/**`, regenerates types in `packages/convex/_generated/`, and pushes function code to your deployment. **Keep it running** while you iterate — the moment you save `schema.ts` or a query/mutation, it republishes within 1–2 seconds.

If you skip this step, your web app will be talking to a stale function bundle on the server and TypeScript will be out of date with the schema.

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

## The JWT chicken-and-egg

The Convex deployment needs two env vars to validate auth tokens:

- `JWKS` — public key set
- `JWT_PRIVATE_KEY` — signing key

These are **generated lazily by Better Auth on the first sign-in**. Before that first sign-in, `pnpm check:convex` will complain those keys are missing — that's expected. The bootstrap flow is:

1. `pnpm dev` boots the app even with the keys missing.
2. You sign in once (any method) — Better Auth generates the keys, persists them to Convex's env.
3. `pnpm sync:convex-env` pushes the rest of your local secrets back. From now on, `pnpm check:convex` is green.

We do **not** push these two keys via `pnpm sync:convex-env` — they're omitted from `CONVEX_SYNC_KEYS` in [`scripts/_env-keys.mjs`](../scripts/_env-keys.mjs) so existing sessions don't get invalidated by an accidental overwrite.

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
- **`pnpm dev` boots but mutations 401.** → JWT bootstrap not done. Sign in once via the app, then `pnpm sync:convex-env`.
- **`pnpm check:convex` says JWKS / JWT_PRIVATE_KEY missing.** → Same as above — expected on a fresh deployment until you've signed in once.
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
