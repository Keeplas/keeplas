#!/usr/bin/env tsx
// App Store / Google Play review accounts (runbook: apps/mobile/APP_REVIEW.md).
//
//   pnpm review:status                 # is every REVIEW_PHONES number ready?
//   pnpm review:clear <OWNER_NUMBER>    # undo what reviewers left on a demo account
//   pnpm review:reset <SIGNUP_NUMBER>   # erase that review account now
//   pnpm review:reset <SIGNUP_NUMBER> --yes   # same, without the prompt
//
// They run the internal `store_review` functions on the PROD deployment, where
// the reviewers sign in: the root scripts wrap this file in
// `pnpm with-env --env=prod`, which sets CONVEX_DEPLOYMENT=prod:… for
// `npx convex run --prod`. To try them on dev instead:
//   pnpm with-env -- tsx scripts/review-accounts.mjs status --dev
// (tsx: `status` checks REVIEW_KIT with the app's own crypto, in TypeScript.)
//
// `clear` and `reset` only work for numbers listed in REVIEW_PHONES: the
// server refuses any other number, so a real account can never be touched.
// `status` reads REVIEW_KIT from Infisical to check that it still opens the
// demo accounts, and never prints it or the code.

import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { RED, YELLOW, GREEN, RESET } from "./_env-keys.mjs";
import {
  CONTACT_SEED,
  DEMO_PEOPLE,
  OWNER,
  kitOpens,
  readKit,
} from "../apps/mobile/scripts/review-demo.ts";

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const [command, phoneArg] = args.filter((arg) => !arg.startsWith("--"));
const dev = flags.has("--dev");
const deployment = process.env.CONVEX_DEPLOYMENT ?? "";

function fail(message) {
  console.error(`\n${RED}✗ ${message}${RESET}\n`);
  process.exit(1);
}

if (!["status", "clear", "reset"].includes(command)) {
  fail(
    "Usage: review-accounts.mjs <status | clear +E164 | reset +E164> [--dev] [--yes]",
  );
}
if (dev === deployment.startsWith("prod:")) {
  fail(
    dev
      ? `--dev was given but CONVEX_DEPLOYMENT is ${deployment}.`
      : "Not pointed at prod. Run `pnpm review:status` / `pnpm review:clear` / " +
          "`pnpm review:reset`, which load the prod env (or pass --dev to use dev).",
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

const day = (ms) => new Date(ms).toISOString().slice(0, 10);

function describe(account) {
  const travel = account.lifeCheck?.travelModeUntil
    ? `, travel mode until ${day(account.lifeCheck.travelModeUntil)}`
    : account.lifeCheck?.travelMode
      ? ", travel mode"
      : "";
  const lifeCheck = account.lifeCheck
    ? `${account.lifeCheck.frequency}${travel}`
    : "not set";
  return [
    account.name ?? "(no name)",
    `plan ${account.plan}`,
    `kit ${account.kitVerifier ? "yes" : "no"}`,
    `${account.items} item(s)`,
    `${account.contactsAccepted} accepted contact(s)`,
    `life check ${lifeCheck}`,
    account.deletionScheduled ? "DELETION SCHEDULED" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The review number given on the command line, spaces removed. */
function phoneFromArgs(example) {
  if (!phoneArg) fail(`Give the review number, e.g. ${example}.`);
  return phoneArg.replace(/\s+/g, "");
}

/**
 * What earlier reviewers, or time, left on a demo account: anything that
 * could show "Are you okay?", a recovery or a release during a review counts.
 * `clear` undoes the first list; the second needs a re-seed (APP_REVIEW.md →
 * Demo accounts).
 */
async function drift(person, account, kit) {
  const english = !account.language || account.language.startsWith("en");
  const { lifeCheck, accessRequests } = account;
  const clearable = [
    account.devicesPending > 0 &&
      `${account.devicesPending} device(s) waiting for "It was me"`,
    account.cloudBackup && "cloud backup on (or never turned off)",
    !english && `language ${account.language}`,
    account.email && `email ${account.email} added`,
    lifeCheck?.canStartSoon &&
      (lifeCheck.travelMode && lifeCheck.travelModeUntil
        ? `travel mode ends ${day(lifeCheck.travelModeUntil)}, so a Life check can start`
        : "Life check on without travel mode, so a check-in can start"),
    lifeCheck?.cycle === "running" && `Life check "Are you okay?" in progress`,
    lifeCheck?.cycle === "awaiting_confirmation" &&
      "Life check asking the contacts to confirm",
    accessRequests.pending > 0 &&
      `${accessRequests.pending} contact access request(s) open`,
    account.recoveryRequest &&
      `recovery request open (${account.recoveryRequest})`,
    account.numberChangeRequest &&
      `"Lost your number?" request open (${account.numberChangeRequest})`,
    account.contacts > account.contactsAccepted &&
      `${account.contacts - account.contactsAccepted} invitation(s) never accepted`,
  ];
  const kitOk =
    kit === null || // Reported once, as a problem of its own.
    (Boolean(account.kitVerifier) &&
      (await kitOpens(kit, account.kitVerifier)));
  const reseed = [
    !kitOk && "REVIEW_KIT no longer opens it",
    account.masterKeyRotationRequired &&
      `key rotation pending ("It wasn't me" was tapped)`,
    person === OWNER &&
      account.plan !== "free" &&
      `on ${account.plan}: reviewers cannot test the purchase`,
    account.deletionScheduled && "deletion scheduled",
    accessRequests.approved > 0 && "vault released to its contacts",
    person !== OWNER &&
      (account.items !== CONTACT_SEED.items ||
        account.contactsAccepted !== CONTACT_SEED.contacts) &&
      `${account.items} item(s) and ${account.contactsAccepted} accepted contact(s), ` +
        `seeded with ${CONTACT_SEED.items} and ${CONTACT_SEED.contacts}`,
  ];
  return {
    clearable: clearable.filter(Boolean),
    reseed: reseed.filter(Boolean),
  };
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

  let kit = null;
  try {
    kit = readKit();
  } catch {
    // Reported below; Infisical's error is not worth more than the hint.
  }
  if (kit?.length !== 24) {
    kit = null;
    problems.push(
      "Could not read the 24 words of REVIEW_KIT from Infisical prod " +
        "/keeplas_mobile (`infisical login`), so the demo accounts' kit is unchecked.",
    );
  }
  for (const person of DEMO_PEOPLE) {
    const label = `${person.phone} (${person.name})`;
    const row = accounts.find(
      ({ phoneNumber }) => phoneNumber === person.phone,
    );
    if (!row) {
      problems.push(`${label} is not in REVIEW_PHONES.`);
      continue;
    }
    if (!row.account) {
      problems.push(`${label} has no account: run \`pnpm review:seed\`.`);
      continue;
    }
    if (
      person === OWNER &&
      (row.account.items === 0 || row.account.contactsAccepted !== 2)
    ) {
      problems.push(
        `${label} needs vault items and exactly 2 accepted contacts (Alex and Sam): re-seed it.`,
      );
    }
    const { clearable, reseed } = await drift(person, row.account, kit);
    if (clearable.length > 0) {
      problems.push(
        `${label}: ${clearable.join(", ")}. Run \`pnpm review:clear ${person.phone}\`.`,
      );
    }
    if (reseed.length > 0) {
      problems.push(`${label}: ${reseed.join(", ")}. Re-seed it.`);
    }
  }
  const demoPhones = DEMO_PEOPLE.map((person) => person.phone);
  if (
    !accounts.some(
      ({ phoneNumber, account }) =>
        !demoPhones.includes(phoneNumber) && account === null,
    )
  ) {
    problems.push(
      "No spare number without an account: reviewers cannot try sign-up " +
        "(`pnpm review:reset <number>` frees one).",
    );
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

if (command === "clear") {
  const phone = phoneFromArgs(OWNER.phone);
  const cleared = run("store_review:clearDrift", { phoneNumber: phone });
  if (!cleared) {
    console.log(`\n${YELLOW}${phone} has no account.${RESET}\n`);
    process.exit(0);
  }
  console.log(
    `\n${GREEN}✓ ${phone}: ${cleared.devicesConfirmed} device(s) confirmed` +
      `${cleared.backupTurnedOff ? ", cloud backup turned off" : ""}` +
      `${cleared.languageReset ? ", language set back to English" : ""}` +
      `${cleared.lifeCheckPaused ? ", Life check paused with travel mode for 180 days" : ""}` +
      `${cleared.recoveryCancelled ? ", recovery request cancelled" : ""}` +
      `${cleared.numberChangeCancelled ? ', "Lost your number?" request cancelled' : ""}` +
      `${cleared.invitationsRevoked > 0 ? `, ${cleared.invitationsRevoked} invitation(s) revoked` : ""}` +
      `${cleared.emailRemoved ? ", email removed" : ""}.${RESET}\n`,
  );
}

if (command === "reset") {
  const phone = phoneFromArgs("a sign-up number (4th or 5th in REVIEW_PHONES)");
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
