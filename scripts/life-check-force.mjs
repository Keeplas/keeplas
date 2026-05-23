#!/usr/bin/env node
// Force a Life Check check-in to fire RIGHT NOW (no waiting for the weekly /
// monthly / quarterly cadence), so you can verify the dead-man's-switch check-in
// delivery + validation actually works — WhatsApp included.
//
// It runs internal `testing` functions on the DEV Convex deployment via
// `npx convex run` (which always targets dev, never prod — `--prod` is refused
// below). Starting a cycle dispatches every ENABLED channel (push / email /
// WhatsApp) and schedules the reminders + handoff.
//
// Run via:
//   pnpm life-check:force                      # the single configured dev user
//   pnpm life-check:force user@email.com       # pick a user by email
//   pnpm life-check:force -- --whatsapp        # also force the WhatsApp leg
//                                              # (even if not an enabled channel)
//                                              # and await the Infobip result
//   pnpm life-check:force -- --whatsapp-reply  # simulate the user REPLYING on
//                                              # WhatsApp to confirm liveness
//
// Tip: after sending, `pnpm debug:whatsapp` reads the final Infobip delivery
// status (DELIVERED / UNDELIVERABLE + reason).

import { spawnSync } from "node:child_process";
import { RED, YELLOW, GREEN, RESET } from "./_env-keys.mjs";

const args = process.argv.slice(2);
if (args.includes("--prod")) {
  console.error(
    `\n${RED}Refusing to run a test trigger against prod.${RESET}\n`,
  );
  process.exit(1);
}

const email = args.find((a) => !a.startsWith("--"));
const forceWhatsApp = args.includes("--whatsapp");
const whatsAppReply = args.includes("--whatsapp-reply");
const deployment = process.env.CONVEX_DEPLOYMENT ?? "(default dev)";

// Inbound leg: simulate the user replying on WhatsApp to confirm they're alive.
const fn = whatsAppReply ? "testing:confirmWhatsApp" : "testing:forceCheckIn";
const fnArgsObj = email ? { email } : {};
if (!whatsAppReply && forceWhatsApp) fnArgsObj.whatsapp = true;
const fnArgs = JSON.stringify(fnArgsObj);

const action = whatsAppReply
  ? "Simulating a WhatsApp confirmation reply"
  : forceWhatsApp
    ? "Forcing a check-in (+ WhatsApp leg)"
    : "Forcing a Life Check check-in";

console.log(
  `\n${YELLOW}▶ ${action}${RESET}\n` +
    `  deployment: ${deployment}\n` +
    `  target:     ${email ?? "(single configured user)"}\n`,
);

const res = spawnSync("npx", ["--no-install", "convex", "run", fn, fnArgs], {
  stdio: "inherit",
});

if (res.status !== 0) {
  console.error(`\n${RED}✗ ${action} failed.${RESET}\n`);
  process.exit(res.status ?? 1);
}

console.log(
  whatsAppReply
    ? `\n${GREEN}✓ WhatsApp reply simulated.${RESET}\n`
    : `\n${GREEN}✓ Check-in fired.${RESET} Confirm via the app, the email link, or a WhatsApp reply (\`-- --whatsapp-reply\`).\n`,
);
