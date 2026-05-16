#!/usr/bin/env node
// Nuclear cleanup: wipe every `node_modules`, `.next`, and `.turbo`, then
// reinstall from the current lockfile.
//
// Use when you see a runtime / build error referencing an OLD version of a
// dependency (e.g. `next@16.2.3` in an error path when the lockfile is at
// 16.2.6). pnpm's content-addressable store keeps old versions across
// upgrades — sometimes Turbopack's `.next/` cache references those stale
// paths and the app loads a half-and-half mix.
//
// Safe to run any time. Takes ~30–60s depending on disk and network.

import { rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const toDelete = [
  // Root caches
  "node_modules",
  ".turbo",
  // Web app caches
  "apps/web/node_modules",
  "apps/web/.next",
  "apps/web/.turbo",
  // Package caches
  "packages/convex/node_modules",
  "packages/convex/.turbo",
  "packages/crypto/node_modules",
  "packages/crypto/.turbo",
  "packages/ui/node_modules",
  "packages/ui/.turbo",
];

console.log(`\n${BOLD}${CYAN}▸ Deep clean${RESET}\n`);
let removed = 0;
for (const rel of toDelete) {
  const abs = resolve(repoRoot, rel);
  if (existsSync(abs)) {
    rmSync(abs, { recursive: true, force: true });
    console.log(`  ${GREEN}✓${RESET} removed ${DIM}${rel}${RESET}`);
    removed++;
  } else {
    console.log(`  ${DIM}↻ ${rel} (already gone)${RESET}`);
  }
}
console.log(
  `\n${DIM}Removed ${removed} director${removed === 1 ? "y" : "ies"}.${RESET}\n`,
);

console.log(`${BOLD}${CYAN}▸ pnpm install${RESET}\n`);
const result = spawnSync("pnpm", ["install"], {
  cwd: repoRoot,
  stdio: "inherit",
});
if (result.status !== 0) {
  console.error(`\n${RED}pnpm install failed${RESET}`);
  process.exit(result.status ?? 1);
}

console.log(
  `\n${GREEN}${BOLD}Reset complete.${RESET} Run ${CYAN}pnpm dev${RESET} and hard-reload your browser (${BOLD}Cmd+Shift+R${RESET}).\n`,
);
