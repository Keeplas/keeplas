# Docker workflow

The repo ships a `Dockerfile.dev` + `docker-compose.yml` so contributors can run the entire dev stack without installing Node, pnpm, or even Convex CLI on their host. The image pins Node 22 and pnpm 10.8.1 to match CI — useful when you're chasing a "works on my machine" bug or onboarding on a fresh laptop.

> Docker is **optional**. The native path (`pnpm bootstrap` → `npx convex dev`) is faster for daily work because Vite's HMR is slower across the bind mount. Docker shines for **reproducibility** (CI parity) and **fresh-machine onboarding**.

## What you need

- Docker Desktop on macOS / Windows, or Docker Engine 24+ with Compose v2 on Linux.
- That's it — no Node, no pnpm, no Convex CLI on the host.

## What the container provides

- **Node 22** + **pnpm 10.8.1**, pinned. Matches CI exactly.
- The full monorepo bind-mounted at `/app`. Edits on the host hot-reload inside the container.
- Named volumes for `node_modules` (root + per-package), `dist/`, `.turbo/`, and `.convex/` so they don't churn the host filesystem.
- Port `3000` forwarded → reach the dev app at <http://localhost:3000> from your host browser.

The image is **`Dockerfile.dev`** — not production. No production Dockerfile is shipped; deployments target Vercel (web) + Convex Cloud (backend).

## First-time setup

```bash
# 1. Create your .env.local on the host (the container reads from the bind mount)
cp .env.example .env.local
# fill KEEPLAS_CTX_SECRET → `openssl rand -base64 32`

# 2. Provision your Convex deployment (runs inside the container — opens a browser on the host)
docker compose run --rm --service-ports app npx convex dev --once --configure=new

# 3. Symlink per-package envs (idempotent)
docker compose run --rm app pnpm link:env

# 4. Boot the stack
docker compose up
```

Open <http://localhost:3000>, sign in once to bootstrap Better Auth's JWT keys, then:

```bash
docker compose exec app pnpm sync:convex-env
```

That's the full first-time flow. After this, `docker compose up` is all you need.

## Daily workflow

```bash
docker compose up              # start the stack (Ctrl-C to stop)
docker compose up -d           # detached
docker compose logs -f         # tail logs
docker compose down            # stop and remove the container (volumes preserved)
docker compose down -v         # full reset — drops every named volume → next `up` reinstalls
```

### Running ad-hoc commands inside the container

`docker compose exec` attaches to the **running** container:

```bash
docker compose exec app pnpm lint
docker compose exec app pnpm typecheck
docker compose exec app pnpm test
docker compose exec app pnpm check:convex
docker compose exec app npx convex dashboard
docker compose exec app sh        # interactive shell
```

`docker compose run` spawns a **one-shot** container (handy when the stack isn't running):

```bash
docker compose run --rm app pnpm install
docker compose run --rm app pnpm link:env
docker compose run --rm app npx convex env list
```

Use `exec` if `docker compose up` is already running; `run --rm` otherwise.

### How files flow between host and container

```
HOST (~/keeplas-app/)              CONTAINER (/app/)
─────────────────────              ─────────────────
src/*.tsx          ◄─── bind ───►  src/*.tsx           # edits reflect both ways
.env.local         ◄─── bind ───►  .env.local
node_modules/      ◄── named ────  /app/node_modules   # volume-only, host is empty
dist/              ◄── named ────  /app/apps/web/dist  # volume-only
.convex/           ◄── named ────  /app/.convex        # volume-only
```

Code, config, and `.env.local` live on the host (bind mount → edits hot-reload). Caches and `node_modules` live in named volumes inside Docker so they don't slow down your host filesystem.

## Container ↔ Convex

The container talks to Convex **the same way** the host would — via the `NEXT_PUBLIC_CONVEX_URL` in `.env.local`. Convex cloud deployments are reachable over the public internet, so there's no host networking magic to think about.

The `.convex/` named volume holds local Convex state (auth tokens, deployment metadata). It survives `docker compose down`. To start with a clean Convex CLI state, `docker compose down -v` drops it along with everything else.

## Common gotchas

- **`docker compose up` exits with `KEEPLAS_CTX_SECRET is missing`.** The `predev` check fires before the dev server boots. Edit `.env.local` on the host (the bind mount carries it into the container) and re-run.
- **WebAuthn / Passkey doesn't work.** The container exposes port 3000 over plain HTTP. WebAuthn requires HTTPS in production but accepts `http://localhost:3000` as a special case. If you're hitting it from another machine on your LAN, that won't work — use the host directly.
- **`pnpm install` is slow.** First boot installs into named volumes. After that, it's cached. Avoid `docker compose down -v` unless you want a full reset.
- **Edits don't hot-reload.** The bind mount works, but Vite HMR on macOS Docker can be slow to detect file changes. If reloads stall, restart with `docker compose restart app`.
- **`convex dev` doesn't see my changes.** You may have started it via `compose run` (one-shot, dies when the command exits). Use `compose exec app npx convex dev` from a second terminal, or `compose up` (which runs `pnpm dev` and includes the Convex watcher transitively).
- **`pnpm link:env` fails with `EPERM`.** On Windows hosts, the named-volume layer doesn't grant symlink permissions. Run Docker Desktop as administrator the first time, or fall back to native (pnpm + Node) on the host.

## When to use Docker vs native

| Use Docker when…                        | Use native when…                                 |
| --------------------------------------- | ------------------------------------------------ |
| You're on a fresh machine               | You want fastest hot-reload (Vite HMR)           |
| You're debugging a CI-only issue        | You're iterating on UI / styles                  |
| You don't want Node + pnpm on the host  | You already have Node 22 + pnpm 10.8.1 installed |
| You want true CI-parity reproducibility | You need to attach a debugger                    |

Most regulars run native. Docker is the safety net.
