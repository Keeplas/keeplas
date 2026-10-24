#!/usr/bin/env node
/**
 * Convex deploy safety guard.
 *
 * Runs `convex deploy --dry-run` from the repo ROOT (so the root convex.json,
 * which points functions at packages/convex/, is honored) and REFUSES the
 * deploy (exit 1) when the generated configuration looks destructive or empty.
 *
 * Why this exists: a `convex deploy` run from packages/convex/ (no local
 * convex.json) used to resolve its functions dir to the empty default
 * `./convex`, pushing ZERO functions and an EMPTY schema to PRODUCTION —
 * silently DELETING every prod index and dropping every function. This guard
 * makes that class of accident impossible: an empty / near-empty / mass-index-
 * deleting push is blocked before it ever reaches the deployment.
 *
 * Floors are derived from the real app (~30 modules, 67 indexes, 3 crons) with
 * generous headroom — they only fire on a clearly broken bundle, never on
 * normal feature work. Bump them only if the app genuinely shrinks.
 */
import { spawnSync } from "node:child_process";

const MIN_MODULES = 15; // real ~30; an empty deploy has 0
const MIN_INDEXES = 40; // real 67; an empty schema has 0
const MIN_CRONS = 1; // real 3; crons.ts must register

function fail(msg) {
  console.error(`\n✖ Convex deploy BLOCKED — ${msg}`);
  console.error(
    "  This guard prevents an empty/destructive push from wiping production.",
  );
  console.error(
    "  Deploy from the repo root with `pnpm deploy:convex` and investigate the\n" +
      "  dry-run output above before retrying.\n",
  );
  process.exit(1);
}

// --dry-run prints what the push would do WITHOUT deploying. --yes skips the
// interactive prod confirmation (unavailable in scripted contexts). Convex
// writes to STDERR, so both streams must be captured.
function dryRun(...flags) {
  const res = spawnSync(
    "npx",
    ["--no-install", "convex", "deploy", "--dry-run", "--yes", ...flags],
    { cwd: process.cwd(), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const output = (res.stdout || "") + (res.stderr || "");
  if (res.error || res.status !== 0) {
    console.error(output);
    fail("`convex deploy --dry-run` itself failed (see output above).");
  }
  return output;
}

// -v prints the generated config (counted below) but skips the readable
// index diff, which only the plain run prints.
const out = dryRun("-v");
const diff = dryRun();

const moduleCount = new Set(
  [...out.matchAll(/"path":\s*"([a-zA-Z0-9_]+)\.js"/g)]
    .map((m) => m[1])
    .filter((name) => name !== "crons"),
).size;

const indexCount = (out.match(/"indexDescriptor":/g) || []).length;

// crons.js present AND its cronSpecs is a non-null array.
const cronsBlock = out.match(
  /"crons\.js":\s*{[\s\S]*?"cronSpecs":\s*(\[|null)/,
);
const cronCount =
  cronsBlock && cronsBlock[1] === "["
    ? (out.match(/"cronSchedule":/g) || []).length
    : 0;

// Indexes the push would delete: the dry-run lists them under "Would delete
// table indexes:" as "  [-] table.index   fields". Without that block it must
// say "No indexes are deleted by this push", otherwise we can't tell.
const lines = diff.split("\n");
const deletedAt = lines.findIndex((line) =>
  line.includes("Would delete table indexes:"),
);
const deletedIndexes = [];
for (let i = deletedAt + 1; deletedAt !== -1 && i < lines.length; i++) {
  const index = lines[i].match(/^\s+\[-\]\s+(\S+)/);
  if (!index) break;
  deletedIndexes.push(index[1]);
}
// An intended deletion is listed explicitly, e.g.
// ALLOW_DELETED_INDEXES=payments.by_session,users.by_stripe_customer
const allowedDeletions = (process.env.ALLOW_DELETED_INDEXES ?? "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);
const unexpectedDeletions = deletedIndexes.filter(
  (name) => !allowedDeletions.includes(name),
);

console.log(
  `Convex deploy preflight → modules=${moduleCount} indexes=${indexCount} ` +
    `crons=${cronCount} deletedIndexes=${deletedIndexes.join(",") || "none"}`,
);

if (moduleCount < MIN_MODULES)
  fail(
    `only ${moduleCount} function modules resolved (min ${MIN_MODULES}). ` +
      "The functions directory is likely empty/misresolved.",
  );
if (indexCount < MIN_INDEXES)
  fail(
    `only ${indexCount} schema indexes resolved (min ${MIN_INDEXES}). ` +
      "An empty schema push would DELETE prod indexes.",
  );
if (cronCount < MIN_CRONS)
  fail(`no cron jobs resolved (min ${MIN_CRONS}). crons.ts not picked up.`);
if (deletedAt === -1 && !/No indexes are deleted by this push/.test(diff))
  fail("the dry-run doesn't say whether this push deletes indexes.");
if (unexpectedDeletions.length > 0)
  fail(
    `this push DELETES table indexes: ${unexpectedDeletions.join(", ")}. ` +
      "If the schema change is intended, re-run with " +
      `ALLOW_DELETED_INDEXES=${deletedIndexes.join(",")}.`,
  );

const DEV_ONLY_FLAGS = [
  "DEV_TEST_PHONES",
  "ATTESTATION_SIMULATOR_BYPASS",
  "APP_ATTEST_ALLOW_DEVELOPMENT",
];
// --names-only prints one name per line and keeps every secret value out of
// this process. Without it, convex >= 1.48 prints names only when it detects
// an AI agent, so a `NAME=value` match would silently find nothing.
const envList = spawnSync(
  "npx",
  ["--no-install", "convex", "env", "list", "--prod", "--names-only"],
  {
    cwd: process.cwd(),
    encoding: "utf8",
  },
);
if (envList.status !== 0) {
  fail(
    "could not read the target deployment's environment to check for " +
      "dev-only flags (`convex env list` failed).",
  );
}
const setFlags = DEV_ONLY_FLAGS.filter((flag) =>
  new RegExp(`^${flag}$`, "m").test(envList.stdout || ""),
);
if (setFlags.length > 0)
  fail(
    `dev-only flag(s) set on the target deployment: ${setFlags.join(", ")}. ` +
      "They let test numbers sign in with 000000 or skip app attestation. " +
      "Remove them with `npx convex env remove <NAME>` before deploying.",
  );

console.log("✔ Convex deploy preflight passed — safe to deploy.\n");
