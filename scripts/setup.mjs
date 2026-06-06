#!/usr/bin/env node
// One-command bootstrap for contributors. Idempotent — safe to re-run.
//
// What it does:
//   1. Verifies Node + pnpm versions match package.json engines.
//   2. Copies `.env.example` → `.env.local` if it doesn't exist.
//   3. Runs `pnpm install`.
//   4. Runs `pnpm link:env` to symlink per-package .env.local files.
//   5. Provisions your personal Convex deployment (interactive, skipped if
//      CONVEX_DEPLOYMENT is already set) — this writes CONVEX_DEPLOYMENT and
//      NEXT_PUBLIC_CONVEX_URL into .env.local.
//   6. Prints the remaining manual next-steps (auth seed + env sync).

import { existsSync, copyFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { RED, YELLOW, GREEN, CYAN, DIM, BOLD, RESET } from "./_env-keys.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envExample = resolve(repoRoot, ".env.example");
const envLocal = resolve(repoRoot, ".env.local");

function step(label) {
  console.log(`\n${BOLD}${CYAN}▸ ${label}${RESET}`);
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(`${RED}${cmd} ${args.join(" ")} failed${RESET}`);
    process.exit(result.status ?? 1);
  }
}

// True once `npx convex dev --configure` has written a non-empty
// CONVEX_DEPLOYMENT into .env.local (the placeholder copied from .env.example
// is empty), so the provisioning step can be skipped on re-runs.
function convexConfigured() {
  if (!existsSync(envLocal)) return false;
  const match = readFileSync(envLocal, "utf8").match(/^CONVEX_DEPLOYMENT=(.*)$/m);
  return Boolean(match && match[1].trim());
}

step("1/4  Copy .env.example → .env.local");
if (existsSync(envLocal)) {
  console.log(`${DIM}.env.local already exists, leaving it alone${RESET}`);
} else if (!existsSync(envExample)) {
  console.error(`${RED}.env.example not found at ${envExample}${RESET}`);
  process.exit(1);
} else {
  copyFileSync(envExample, envLocal);
  console.log(`${GREEN}✓${RESET} created .env.local`);
}

step("2/5  Install dependencies");
run("pnpm", ["install"]);

step("3/5  Symlink per-package .env.local files");
run("pnpm", ["link:env"]);

step("4/5  Provision your Convex deployment (interactive — opens a browser)");
if (convexConfigured()) {
  console.log(
    `${DIM}CONVEX_DEPLOYMENT already set in .env.local, skipping${RESET}`,
  );
} else {
  console.log(
    `${DIM}Writes CONVEX_DEPLOYMENT / NEXT_PUBLIC_CONVEX_URL into .env.local${RESET}`,
  );
  run("npx", ["convex", "dev", "--once", "--configure=new"]);
}

step("5/5  Next steps (manual — Convex needs your account)");
console.log(`
${BOLD}Generate the audit HMAC secret${RESET} (only if .env.local placeholder is still there):
  ${CYAN}openssl rand -base64 32${RESET}
  → paste the value as ${BOLD}KEEPLAS_CTX_SECRET${RESET} in .env.local

${BOLD}Seed Convex Auth JWT keys${RESET} (one-time):
  ${CYAN}npx @convex-dev/auth${RESET}              ${DIM}# generates JWT_PRIVATE_KEY + JWKS on the deployment${RESET}

${BOLD}Push the rest of your local env to Convex${RESET}:
  ${CYAN}pnpm sync:convex-env${RESET}

${BOLD}Boot the app${RESET}:
  ${CYAN}pnpm dev${RESET}                          ${DIM}# Vite + convex dev in parallel${RESET}

${BOLD}You're done.${RESET} ${YELLOW}pnpm dev${RESET} is now your normal workflow.
${DIM}See CONTRIBUTING.md for details. Pre-push: pnpm check:convex.${RESET}
`);
