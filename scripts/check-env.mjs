#!/usr/bin/env node
// Validates required environment variables before `pnpm dev` and `pnpm build`.
// Run via: node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/check-env.mjs

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  RED,
  YELLOW,
  GREEN,
  RESET,
  nonEmpty,
  WEB_REQUIRED,
  WEB_OPTIONAL_GROUPS,
} from "./_env-keys.mjs";

const envLocalPath = resolve(process.cwd(), ".env.local");
const envPath = resolve(process.cwd(), ".env");
if (!existsSync(envLocalPath) && !existsSync(envPath)) {
  console.error(
    `\n${RED}Missing .env.local at ${envLocalPath}${RESET}\n\n` +
      `Run:\n` +
      `  cp .env.example .env.local\n` +
      `  # then fill KEEPLAS_CTX_SECRET (openssl rand -base64 32)\n` +
      `  # then: pnpm link:env\n`,
  );
  process.exit(1);
}

const errors = [];
const warnings = [];

for (const { key, test, hint } of WEB_REQUIRED) {
  if (!test(process.env[key])) {
    errors.push(`${key} is missing or invalid${hint ? ` — ${hint}` : ""}`);
  }
}

for (const [feature, keys] of Object.entries(WEB_OPTIONAL_GROUPS)) {
  const missing = keys.filter((k) => !nonEmpty(process.env[k]));
  if (missing.length === keys.length) {
    warnings.push(`${feature} disabled (all keys empty)`);
  } else if (missing.length > 0) {
    warnings.push(
      `${feature} partially configured — missing: ${missing.join(", ")}`,
    );
  }
}

if (warnings.length) {
  console.warn(`\n${YELLOW}Environment warnings (features disabled):${RESET}`);
  for (const w of warnings) console.warn(`  - ${w}`);
}

if (errors.length) {
  console.error(`\n${RED}Environment check failed:${RESET}`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error(`\nSee .env.example for the full list of keys.\n`);
  process.exit(1);
}

console.log(`${GREEN}Environment check passed${RESET}`);
