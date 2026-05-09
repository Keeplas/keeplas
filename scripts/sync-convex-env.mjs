#!/usr/bin/env node
// Pushes Convex-side env vars from `.env` to the contributor's Convex deployment.
// Run via: node --env-file-if-exists=.env scripts/sync-convex-env.mjs

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

const envLocalPath = resolve(process.cwd(), ".env.local");
const envPath = resolve(process.cwd(), ".env");
if (!existsSync(envLocalPath) && !existsSync(envPath)) {
  console.error(
    `\n${RED}Missing .env.local at ${envLocalPath}${RESET}\n\n` +
      `Run \`cp .env.example .env.local\` first, then re-run this script.\n`,
  );
  process.exit(1);
}

// Keys that must exist on the Convex deployment (server-side actions, audit verification).
// Web-only keys (NEXT_PUBLIC_*, NODE_ENV, CONVEX_MODE, CONVEX_DEPLOYMENT) are intentionally excluded.
const CONVEX_KEYS = [
  "KEEPLAS_CTX_SECRET",
  "WEBAUTHN_RP_ID",
  "WEBAUTHN_RP_NAME",
  "WEBAUTHN_ORIGIN",
  "APP_URL",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "SUPPORT_INBOX_EMAIL",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "WHATSAPP_PHONE_ID",
  "WHATSAPP_TOKEN",
  "WHATSAPP_TEMPLATE_NAME",
  "WHATSAPP_TEMPLATE_LANG",
];

let pushed = 0;
let skipped = 0;
const failures = [];

for (const key of CONVEX_KEYS) {
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

console.log(`\nPushed ${pushed} / ${CONVEX_KEYS.length} keys to Convex (${skipped} skipped — empty in .env).`);

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
