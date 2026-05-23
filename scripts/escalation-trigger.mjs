#!/usr/bin/env node
// Trigger the ENTIRE Life Check Escalation Protocol end-to-end with every timer
// collapsed (the 15-day check-in window, the 7-day confirmation window and the
// 72h owner-cancel grace), so you can verify the whole pipeline without waiting
// weeks.
//
// Stages driven (each calls the same production function the scheduler would):
//   1. start a check-in cycle
//   2. hand off to the trusted-contact confirmation stage (Stage 2)
//   3. simulate the confirmation quorum   (or apply the fallback policy when the
//      owner has no trusted contacts)
//   4. skip the grace window and release the vault
//
// WARNING: this fires a REAL release on the target deployment — recipients get
// an access_request + a notification. It refuses to run against prod and asks
// for confirmation unless --yes is passed.
//
// Run via:
//   pnpm life-check:escalate                    # the single configured dev user
//   pnpm life-check:escalate user@email.com     # pick a user by email
//   pnpm life-check:escalate -- --yes           # skip the confirmation prompt

import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { RED, YELLOW, GREEN, CYAN, RESET } from "./_env-keys.mjs";

const args = process.argv.slice(2);
if (args.includes("--prod")) {
  console.error(
    `\n${RED}Refusing to run the escalation against prod.${RESET}\n`,
  );
  process.exit(1);
}

const deployment = process.env.CONVEX_DEPLOYMENT ?? "(default dev)";
if (deployment.startsWith("prod:")) {
  console.error(
    `\n${RED}CONVEX_DEPLOYMENT is ${deployment} — refusing to escalate on prod.${RESET}\n`,
  );
  process.exit(1);
}

const email = args.find((a) => !a.startsWith("--"));
const skipPrompt = args.includes("--yes");
const fnArgs = email ? JSON.stringify({ email }) : "{}";

console.log(
  `\n${YELLOW}▶ Escalation Protocol — full run${RESET}\n` +
    `  deployment: ${deployment}\n` +
    `  target:     ${email ?? "(single configured user)"}\n`,
);

if (!skipPrompt) {
  const rl = createInterface({ input, output });
  const answer = await rl.question(
    `${RED}This fires a REAL vault release (recipients notified). Continue? (y/N) ${RESET}`,
  );
  rl.close();
  if (answer.trim().toLowerCase() !== "y") {
    console.log("Aborted.\n");
    process.exit(0);
  }
}

const run = spawnSync(
  "npx",
  ["--no-install", "convex", "run", "testing:runEscalation", fnArgs],
  { stdio: "inherit" },
);
if (run.status !== 0) {
  console.error(`\n${RED}✗ Escalation failed.${RESET}\n`);
  process.exit(run.status ?? 1);
}

// The release fan-out is scheduled (it runs ~immediately after the trigger
// commits). Give it a moment, then print the resulting state.
await new Promise((r) => setTimeout(r, 2000));
console.log(`\n${CYAN}Final state:${RESET}`);
spawnSync("npx", ["--no-install", "convex", "run", "testing:summary", fnArgs], {
  stdio: "inherit",
});

console.log(`\n${GREEN}✓ Escalation Protocol complete.${RESET}\n`);
