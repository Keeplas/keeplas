#!/usr/bin/env node
// Boot the full dev stack from the repo root:
//   1. `pnpm check:convex-env` in the background (warn-only, never blocks).
//   2. `pnpm --filter @keeplas/web dev` — Next.js dev server.
//   3. `npx convex dev` — Convex function watcher.
//
// Why we don't let turbo orchestrate `convex dev`: when turbo spawns it
// from `packages/convex/`, local Convex deployments fail because the local
// deployment registration is keyed to the repo root. Spawning `convex dev`
// from the root works for both cloud and local deployments.

import { spawn } from "node:child_process";
import { YELLOW, GREEN, DIM, RESET } from "./_env-keys.mjs";

const skipCheck =
  process.env.CI === "true" || process.env.KEEPLAS_SKIP_CONVEX_CHECK === "1";

if (!skipCheck) {
  const check = spawn("pnpm", ["check:convex-env"], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  let stdout = "";
  let stderr = "";
  check.stdout.on("data", (chunk) => (stdout += chunk));
  check.stderr.on("data", (chunk) => (stderr += chunk));

  check.on("exit", (code) => {
    if (code === 0) {
      console.log(`${DIM}${GREEN}✓${RESET}${DIM} convex env in sync${RESET}`);
      return;
    }
    console.log(
      `\n${YELLOW}⚠ convex env check found drift (dev server is unaffected):${RESET}`,
    );
    const tail = (stdout + stderr)
      .split("\n")
      .filter((l) => l.trim())
      .slice(-12)
      .join("\n");
    console.log(tail);
    console.log(
      `${DIM}Fix with: ${RESET}${YELLOW}pnpm sync:convex-env${RESET}${DIM} — then re-run pnpm dev.${RESET}\n`,
    );
  });

  check.on("error", () => {
    // swallow — never break dev
  });
}

const children = [
  spawn("npx", ["convex", "dev"], { stdio: "inherit" }),
  spawn("pnpm", ["--filter", "@keeplas/web", "dev"], { stdio: "inherit" }),
];

let stopping = false;
function stopAll(signal) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => stopAll(sig));
}

for (const child of children) {
  child.on("exit", (code) => {
    // First child to exit tears down the rest so we don't leave half a stack
    // running. Propagate that child's exit code.
    if (!stopping) {
      const exitCode = code ?? 0;
      stopAll("SIGTERM");
      process.exit(exitCode);
    }
  });
}
