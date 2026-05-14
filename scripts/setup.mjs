#!/usr/bin/env node
// One-command bootstrap for contributors. Idempotent — safe to re-run.
//
// What it does:
//   1. Verifies Node + pnpm versions match package.json engines.
//   2. Copies `.env.local.example` → `.env.local` if it doesn't exist.
//   3. Runs `pnpm install`.
//   4. Runs `pnpm link:env` to symlink per-package .env.local files.
//   5. Prints the manual next-steps (Convex bootstrap + env sync).

import { existsSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envExample = resolve(repoRoot, ".env.local.example");
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

step("1/4  Copy .env.local.example → .env.local");
if (existsSync(envLocal)) {
  console.log(`${DIM}.env.local already exists, leaving it alone${RESET}`);
} else if (!existsSync(envExample)) {
  console.error(`${RED}.env.local.example not found at ${envExample}${RESET}`);
  process.exit(1);
} else {
  copyFileSync(envExample, envLocal);
  console.log(`${GREEN}✓${RESET} created .env.local`);
}

step("2/4  Install dependencies");
run("pnpm", ["install"]);

step("3/4  Symlink per-package .env.local files");
run("pnpm", ["link:env"]);

step("4/4  Next steps (manual — Convex needs your account)");
console.log(`
${BOLD}Generate the audit HMAC secret${RESET} (only if .env.local placeholder is still there):
  ${CYAN}openssl rand -base64 32${RESET}
  → paste the value as ${BOLD}KEEPLAS_CTX_SECRET${RESET} in .env.local

${BOLD}Initialize your Convex deployment${RESET} (one-time):
  ${CYAN}npx convex dev --once --configure=new${RESET}
  This writes CONVEX_DEPLOYMENT / NEXT_PUBLIC_CONVEX_URL into .env.local.

${BOLD}Seed Convex Auth JWT keys${RESET} (one-time):
  ${CYAN}npx @convex-dev/auth${RESET}              ${DIM}# generates JWT_PRIVATE_KEY + JWKS on the deployment${RESET}

${BOLD}Push the rest of your local env to Convex${RESET}:
  ${CYAN}pnpm sync:convex-env${RESET}

${BOLD}Boot the app${RESET}:
  ${CYAN}pnpm dev${RESET}                          ${DIM}# Next.js + convex dev in parallel${RESET}

${BOLD}You're done.${RESET} ${YELLOW}pnpm dev${RESET} is now your normal workflow.
${DIM}See CONTRIBUTING.md for details. Pre-push: pnpm check:convex.${RESET}
`);
