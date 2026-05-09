#!/usr/bin/env node
// Validates required environment variables before `pnpm dev` and `pnpm build`.
// Run via: node --env-file-if-exists=.env scripts/check-env.mjs

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
      `Run:\n` +
      `  cp .env.example .env.local\n` +
      `  # then fill KEEPLAS_CTX_SECRET (openssl rand -base64 32)\n` +
      `  # then: pnpm link:env\n`,
  );
  process.exit(1);
}

const isHttpUrl = (v) => typeof v === "string" && /^https?:\/\//.test(v);
const nonEmpty = (v) => typeof v === "string" && v.length > 0;

const required = [
  { key: "NEXT_PUBLIC_APP_URL", test: isHttpUrl },
  { key: "APP_URL", test: isHttpUrl },
  { key: "NODE_ENV", test: (v) => ["development", "production", "test"].includes(v) },
  { key: "CONVEX_MODE", test: (v) => ["cloud", "selfhosted"].includes(v) },
  {
    key: "CONVEX_DEPLOYMENT",
    test: nonEmpty,
    hint: "Run `npx convex dev --once --configure=new` first to create your deployment.",
  },
  { key: "NEXT_PUBLIC_CONVEX_URL", test: isHttpUrl },
  { key: "WEBAUTHN_RP_ID", test: nonEmpty },
  { key: "WEBAUTHN_RP_NAME", test: nonEmpty },
  { key: "WEBAUTHN_ORIGIN", test: isHttpUrl },
  {
    key: "KEEPLAS_CTX_SECRET",
    test: (v) => {
      if (!nonEmpty(v) || v.startsWith("replace-me")) return false;
      try {
        return Buffer.from(v, "base64").length >= 32;
      } catch {
        return false;
      }
    },
    hint: "Generate with `openssl rand -base64 32` and also set it on Convex via `pnpm sync:convex-env`.",
  },
];

const optionalGroups = {
  "Email (Resend)": ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "SUPPORT_INBOX_EMAIL"],
  "Web Push (VAPID)": [
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  ],
  "WhatsApp Cloud API": ["WHATSAPP_PHONE_ID", "WHATSAPP_TOKEN"],
};

const errors = [];
const warnings = [];

for (const { key, test, hint } of required) {
  if (!test(process.env[key])) {
    errors.push(`${key} is missing or invalid${hint ? ` — ${hint}` : ""}`);
  }
}

for (const [feature, keys] of Object.entries(optionalGroups)) {
  const missing = keys.filter((k) => !nonEmpty(process.env[k]));
  if (missing.length === keys.length) {
    warnings.push(`${feature} disabled (all keys empty)`);
  } else if (missing.length > 0) {
    warnings.push(`${feature} partially configured — missing: ${missing.join(", ")}`);
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
