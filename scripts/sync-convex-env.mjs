#!/usr/bin/env node
// Pushes Convex-side env vars from local env files to the contributor's
// Convex deployment. Run via:
//   node --env-file-if-exists=.env --env-file-if-exists=.env.local \
//        --env-file-if-exists=.env.convex.local \
//        scripts/sync-convex-env.mjs
//
// `.env.convex.local` exists so backend-only secrets (e.g. SITE_URL) can live
// outside `.env.local` (which Next.js auto-loads).

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  RED,
  YELLOW,
  GREEN,
  RESET,
  CONVEX_SYNC_KEYS,
  CONVEX_SYNC_REQUIRED_KEYS,
} from "./_env-keys.mjs";

const envLocalPath = resolve(process.cwd(), ".env.local");
const envPath = resolve(process.cwd(), ".env");
if (!existsSync(envLocalPath) && !existsSync(envPath)) {
  console.error(
    `\n${RED}Missing .env.local at ${envLocalPath}${RESET}\n\n` +
      `Run \`cp .env.example .env.local\` first, then re-run this script.\n`,
  );
  process.exit(1);
}

const missingRequired = CONVEX_SYNC_REQUIRED_KEYS.filter(
  (key) => !process.env[key],
);

if (missingRequired.length) {
  console.error(
    `\n${RED}Cannot sync — required keys are empty in your local env files:${RESET}`,
  );
  for (const key of missingRequired) console.error(`  - ${key}`);
  console.error(
    `\nFill them in \`.env.local\` (web-shared) or \`.env.convex.local\` (Convex-only) and re-run.\n`,
  );
  process.exit(1);
}

let pushed = 0;
let skipped = 0;
const failures = [];

for (const key of CONVEX_SYNC_KEYS) {
  const value = process.env[key];
  if (!value) {
    skipped++;
    continue;
  }
  const result = spawnSync("npx", ["convex", "env", "set", key, value], {
    stdio: ["inherit", "pipe", "pipe"],
    encoding: "utf8",
  });
  if (result.status !== 0) {
    failures.push({ key, stderr: (result.stderr || "").trim() });
    continue;
  }
  console.log(`${GREEN}✓${RESET} ${key}`);
  pushed++;
}

console.log(
  `\nPushed ${pushed} / ${CONVEX_SYNC_KEYS.length} keys to Convex (${skipped} skipped — empty in env, all optional).`,
);

if (failures.length) {
  console.error(`\n${RED}Failures:${RESET}`);
  for (const { key, stderr } of failures) {
    console.error(`  - ${key}${stderr ? ` → ${stderr}` : ""}`);
  }
  console.error(
    `\n${YELLOW}Hint:${RESET} make sure you ran \`npx convex dev --once --configure=new\` first and that you are authenticated.`,
  );
  process.exit(1);
}
