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
const MAX_DELETED_INDEXES = 5; // a correct change rarely drops many at once

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

// --dry-run prints the generated config WITHOUT deploying. --yes skips the
// interactive prod confirmation (unavailable in scripted contexts). Convex
// writes the verbose config to STDERR, so both streams must be captured.
const res = spawnSync(
  "npx",
  ["--no-install", "convex", "deploy", "--dry-run", "--yes", "-v"],
  { cwd: process.cwd(), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
const out = (res.stdout || "") + (res.stderr || "");
if (res.error || res.status !== 0) {
  console.error(out);
  fail("`convex deploy --dry-run` itself failed (see output above).");
}

const moduleCount = new Set(
  [...out.matchAll(/"path":\s*"([a-zA-Z0-9_]+)\.js"/g)]
    .map((m) => m[1])
    .filter((name) => name !== "crons"),
).size;

const indexCount = (out.match(/"indexDescriptor":/g) || []).length;

// crons.js present AND its cronSpecs is a non-null array.
const cronsBlock = out.match(/"crons\.js":\s*{[\s\S]*?"cronSpecs":\s*(\[|null)/);
const cronCount =
  cronsBlock && cronsBlock[1] === "["
    ? (out.match(/"cronSchedule":/g) || []).length
    : 0;

// Destructive index removal — both the human-readable banner and the machine
// list are checked.
const deletedBanner = /Deleted table indexes:/i.test(out);
const deletedIndexCount = (out.match(/"deleted_indexes":\s*\[\s*[^\]]/g) || [])
  .length;

console.log(
  `Convex deploy preflight → modules=${moduleCount} indexes=${indexCount} ` +
    `crons=${cronCount} deletedBanner=${deletedBanner}`,
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
if (deletedBanner || deletedIndexCount > MAX_DELETED_INDEXES)
  fail(
    "this push DELETES table indexes. Refusing automatically — re-run " +
      "interactively and confirm only if the schema change is intentional.",
  );

console.log("✔ Convex deploy preflight passed — safe to deploy.\n");
