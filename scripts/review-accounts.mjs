#!/usr/bin/env node
// App Store / Google Play review accounts (runbook: apps/mobile/APP_REVIEW.md).
//
//   pnpm review:status                 # is every REVIEW_PHONES number ready?
//   pnpm review:reset +12025550104     # erase that review account now
//   pnpm review:reset +12025550104 --yes   # same, without the prompt
//
// Both run the internal `store_review` functions on the PROD deployment, where
// the reviewers sign in: the root scripts wrap this file in
// `pnpm with-env --env=prod`, which sets CONVEX_DEPLOYMENT=prod:… for
// `npx convex run --prod`. To try them on dev instead:
//   pnpm with-env -- node scripts/review-accounts.mjs status --dev
//
// `reset` only works for numbers listed in REVIEW_PHONES: the server refuses
// any other number, so a real account can never be wiped this way.

import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { RED, YELLOW, GREEN, RESET } from "./_env-keys.mjs";

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const [command, phoneArg] = args.filter((arg) => !arg.startsWith("--"));
const dev = flags.has("--dev");
const deployment = process.env.CONVEX_DEPLOYMENT ?? "";

function fail(message) {
  console.error(`\n${RED}✗ ${message}${RESET}\n`);
  process.exit(1);
}

if (command !== "status" && command !== "reset") {
  fail("Usage: review-accounts.mjs <status | reset +E164> [--dev] [--yes]");
}
if (dev === deployment.startsWith("prod:")) {
  fail(
    dev
      ? `--dev was given but CONVEX_DEPLOYMENT is ${deployment}.`
      : "Not pointed at prod. Run `pnpm review:status` / `pnpm review:reset`, " +
          "which load the prod env (or pass --dev to use dev).",
  );
}

function run(fn, fnArgs) {
  const res = spawnSync(
    "npx",
    [
      "--no-install",
      "convex",
      "run",
      ...(dev ? [] : ["--prod"]),
      fn,
      JSON.stringify(fnArgs),
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  if (res.status !== 0) fail(`${fn} failed on ${deployment}.`);
  try {
    return JSON.parse(res.stdout);
  } catch {
    fail(`Unexpected output from ${fn}:\n${res.stdout}`);
  }
}

function describe(account) {
  const lifeCheck = account.lifeCheck
    ? `${account.lifeCheck.frequency}${account.lifeCheck.travelMode ? ", travel mode" : ""}`
    : "not set";
  return [
    account.name ?? "(no name)",
    `plan ${account.plan}`,
    `kit ${account.recoveryKit ? "yes" : "no"}`,
    `${account.items} item(s)`,
    `${account.contactsAccepted} accepted contact(s)`,
    `life check ${lifeCheck}`,
    account.deletionScheduled ? "DELETION SCHEDULED" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

if (command === "status") {
  const { code, accounts } = run("store_review:status", {});
  console.log(`\n${YELLOW}Store review accounts on ${deployment}${RESET}\n`);
  console.log(`  REVIEW_CODE: ${code}`);
  for (const { phoneNumber, account } of accounts) {
    console.log(
      `  ${phoneNumber}  ${account ? describe(account) : "no account (free for a sign-up test)"}`,
    );
  }

  const problems = [];
  if (code !== "set") problems.push("REVIEW_CODE must be exactly 6 digits.");
  if (accounts.length === 0) problems.push("REVIEW_PHONES is empty.");
  const demo = accounts.find(
    ({ account }) =>
      account &&
      account.recoveryKit &&
      account.items > 0 &&
      account.contactsAccepted >= 2,
  )?.account;
  if (!demo) {
    problems.push(
      "No demo account with a recovery kit, vault items and 2 accepted contacts.",
    );
  } else if (demo.plan !== "free") {
    problems.push(
      "The demo account is on Lifetime: reviewers cannot test the purchase.",
    );
  }
  if (!accounts.some(({ account }) => account === null)) {
    problems.push(
      "No spare number without an account: reviewers cannot try sign-up " +
        "(`pnpm review:reset <number>` frees one).",
    );
  }
  for (const { phoneNumber, account } of accounts) {
    if (account?.deletionScheduled) {
      problems.push(`${phoneNumber} has a deletion scheduled.`);
    }
  }

  if (problems.length === 0) {
    console.log(`\n${GREEN}✓ Ready for review.${RESET}\n`);
  } else {
    console.log(`\n${RED}Not ready:${RESET}`);
    for (const problem of problems) console.log(`  - ${problem}`);
    console.log("");
    process.exit(1);
  }
}

if (command === "reset") {
  if (!phoneArg) fail("Give the review number to reset, e.g. +12025550104.");
  const phone = phoneArg.replace(/\s+/g, "");
  // Show what would be erased first: a typo between the demo owner and the
  // spare sign-up number must not go unnoticed.
  const listed = run("store_review:status", {}).accounts.find(
    ({ phoneNumber }) => phoneNumber === phone,
  );
  if (!listed) fail(`${phone} is not in REVIEW_PHONES on ${deployment}.`);
  if (!listed.account) {
    console.log(
      `\n${YELLOW}${phone} has no account: it is already free.${RESET}\n`,
    );
    process.exit(0);
  }
  console.log(`\n${phone}: ${describe(listed.account)}`);
  if (!flags.has("--yes")) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await rl.question(
      `Erase this account on ${deployment} now? It cannot be ` +
        "undone. Type the number again to confirm: ",
    );
    rl.close();
    if (answer.replace(/\s+/g, "") !== phone) {
      fail("Not confirmed, nothing was erased.");
    }
  }
  run("store_review:reset", { phoneNumber: phone });
  console.log(
    `\n${GREEN}✓ ${phone} is being erased; it can sign up again in a minute.${RESET}\n`,
  );
}
