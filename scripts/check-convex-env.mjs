#!/usr/bin/env node
// Validates that the Convex deployment has every required server-side env var.
// Run via:
//   node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/check-convex-env.mjs
//
// The local `.env.local` is loaded so we can compare KEEPLAS_CTX_SECRET on both
// sides — the HMAC signing on the web server MUST match the verification key on
// Convex, otherwise every audited mutation fails.

import { spawnSync } from "node:child_process";
import {
  RED,
  YELLOW,
  GREEN,
  RESET,
  nonEmpty,
  CONVEX_REQUIRED,
  CONVEX_OPTIONAL_GROUPS,
} from "./_env-keys.mjs";

const result = spawnSync("npx", ["convex", "env", "list"], {
  stdio: ["inherit", "pipe", "pipe"],
  encoding: "utf8",
});

if (result.status !== 0) {
  console.error(`\n${RED}Failed to read Convex env:${RESET}`);
  console.error((result.stderr || "").trim());
  console.error(
    `\n${YELLOW}Hint:${RESET} make sure you ran \`npx convex dev --once --configure=new\` ` +
      `first and that you are authenticated.\n`,
  );
  process.exit(1);
}

const remote = parseEnvList(result.stdout);
const errors = [];
const warnings = [];

for (const { key, test, mustMatchLocal, hint } of CONVEX_REQUIRED) {
  const value = remote.get(key);
  if (!test(value)) {
    errors.push(`${key} is missing or invalid on Convex${hint ? ` — ${hint}` : ""}`);
    continue;
  }
  if (mustMatchLocal) {
    const local = process.env[key];
    if (!nonEmpty(local)) {
      errors.push(
        `${key} is set on Convex but missing in .env.local — they MUST match (HMAC signing key).`,
      );
    } else if (local !== value) {
      errors.push(
        `${key} value on Convex does not match .env.local — they MUST match (HMAC signing key). ` +
          `Re-run \`pnpm sync:convex-env\` to push the local value.`,
      );
    }
  }
}

for (const [feature, keys] of Object.entries(CONVEX_OPTIONAL_GROUPS)) {
  const missing = keys.filter((k) => !nonEmpty(remote.get(k)));
  if (missing.length === keys.length) {
    warnings.push(`${feature} disabled on Convex (all keys empty)`);
  } else if (missing.length > 0) {
    warnings.push(
      `${feature} partially configured on Convex — missing: ${missing.join(", ")}`,
    );
  }
}

if (warnings.length) {
  console.warn(
    `\n${YELLOW}Convex env warnings (features disabled):${RESET}`,
  );
  for (const w of warnings) console.warn(`  - ${w}`);
}

if (errors.length) {
  console.error(`\n${RED}Convex env check failed:${RESET}`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error(
    `\nFix: \`pnpm sync:convex-env\` pushes local values to Convex.\n`,
  );
  process.exit(1);
}

console.log(`${GREEN}Convex env check passed${RESET}`);

function parseEnvList(stdout) {
  const map = new Map();
  for (const line of stdout.split(/\r?\n/)) {
    if (!line) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    map.set(line.slice(0, idx), line.slice(idx + 1));
  }
  return map;
}
