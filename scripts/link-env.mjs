#!/usr/bin/env node
// Replaces apps/web/.env.local and packages/convex/.env.local with symlinks
// pointing to the root .env.local — single source of truth for monorepo env vars.
// Idempotent: safe to re-run.

import {
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  renameSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RED, YELLOW, GREEN, DIM, RESET } from "./_env-keys.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const masterPath = resolve(repoRoot, ".env.local");

if (!existsSync(masterPath)) {
  console.error(
    `\n${RED}Master .env.local not found at ${masterPath}${RESET}\n\n` +
      `Create it first:\n` +
      `  cp .env.example .env.local\n` +
      `  # then fill KEEPLAS_CTX_SECRET (openssl rand -base64 32)\n`,
  );
  process.exit(1);
}

const targets = [
  resolve(repoRoot, "apps/web/.env.local"),
  resolve(repoRoot, "packages/convex/.env.local"),
];

const masterContent = readFileSync(masterPath, "utf8");
let linked = 0;
let alreadyLinked = 0;
let backedUp = 0;
const backups = [];

for (const target of targets) {
  const linkTarget = relative(dirname(target), masterPath);
  const rel = relative(repoRoot, target);

  if (existsSync(target) || symlinkExists(target)) {
    const stat = lstatSync(target);
    if (stat.isSymbolicLink()) {
      const current = readlinkSync(target);
      if (current === linkTarget) {
        console.log(`${DIM}↻ ${rel} already linked${RESET}`);
        alreadyLinked++;
        continue;
      }
      // Wrong symlink target — replace
      unlinkSync(target);
    } else {
      // Regular file — back up if drifted, otherwise just remove
      const targetContent = readFileSync(target, "utf8");
      if (targetContent === masterContent) {
        unlinkSync(target);
        console.log(`${DIM}  ${rel} was identical, removed${RESET}`);
      } else {
        const backupPath = `${target}.backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
        renameSync(target, backupPath);
        backups.push(relative(repoRoot, backupPath));
        backedUp++;
      }
    }
  }

  symlinkSync(linkTarget, target);
  console.log(`${GREEN}✓${RESET} ${rel} → ${linkTarget}`);
  linked++;
}

console.log(
  `\nLinked ${linked} file(s), ${alreadyLinked} already linked, ${backedUp} backed up.`,
);
if (backups.length) {
  console.log(`\n${YELLOW}Backups (you can delete once verified):${RESET}`);
  for (const b of backups) console.log(`  - ${b}`);
}

function symlinkExists(p) {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}
