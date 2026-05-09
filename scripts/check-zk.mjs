#!/usr/bin/env node
/**
 * Zero-knowledge invariant checks. Runs as a pre-commit hook against the
 * staged files and as a manual `pnpm check:zk` over the whole repo.
 *
 * Two invariants:
 *  1. Vault items must never be created or updated with `accessLevel: "public"`.
 *     Public access would imply unencrypted data on Emergency Card QRs.
 *  2. Convex `ctx.storage.*` calls (and `Id<"_storage">` imports) must only
 *     appear inside `packages/convex/lib/storage.ts`. The wrapper exists so we
 *     can swap S3 / GCS / R2 without rewriting every domain file.
 *
 * Exits with code 1 on the first violation, printing path + line number.
 */
import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { readdirSync } from "node:fs";

const REPO_ROOT = process.cwd();
const STORAGE_WRAPPER_REL = join("packages", "convex", "lib", "storage.ts");

// Only source paths we control. Skipping scripts/, docs/, and node_modules
// keeps documentation comments and tooling out of the regex window.
const SCANNED_PREFIXES = [
	join("apps", "web", "src"),
	join("packages", "convex"),
	join("packages", "crypto"),
	join("packages", "ui"),
];

function isInScannedTree(relPath) {
	return SCANNED_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

/**
 * @typedef {{ pattern: RegExp, message: string, allow?: (relPath: string) => boolean }} Rule
 */

/** @type {Rule[]} */
const RULES = [
	{
		pattern: /accessLevel\s*:\s*["']public["']/,
		message:
			'Vault items must never use accessLevel: "public" — breaks the ZK model.',
	},
	{
		pattern: /\bctx\.storage\.(generateUploadUrl|getUrl|store|get|delete)\b/,
		message:
			"Direct ctx.storage.* call. Route storage access through packages/convex/lib/storage.ts.",
		allow: (relPath) => relPath === STORAGE_WRAPPER_REL,
	},
	{
		pattern: /Id<["']_storage["']>/,
		message:
			"Do not import Id<\"_storage\"> outside packages/convex/lib/storage.ts.",
		allow: (relPath) => relPath === STORAGE_WRAPPER_REL,
	},
];

const SCANNED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const IGNORED_DIRS = new Set([
	"node_modules",
	".next",
	".turbo",
	"_generated",
	".git",
	"dist",
	"build",
]);

function getFilesFromArgs() {
	const fromCli = process.argv.slice(2).filter(Boolean);
	if (fromCli.length > 0) return fromCli;

	// When invoked with no args, infer staged files (pre-commit hook path).
	try {
		const out = execSync("git diff --cached --name-only --diff-filter=ACMR", {
			encoding: "utf8",
		});
		const staged = out
			.split("\n")
			.map((s) => s.trim())
			.filter(Boolean);
		if (staged.length > 0) return staged;
	} catch {
		// Not in a git context — fall through to whole-repo scan.
	}
	return null;
}

function walk(dir, acc) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (IGNORED_DIRS.has(entry.name)) continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(full, acc);
		} else if (
			entry.isFile() &&
			SCANNED_EXTENSIONS.has(extname(entry.name))
		) {
			acc.push(full);
		}
	}
	return acc;
}

function extname(name) {
	const idx = name.lastIndexOf(".");
	return idx === -1 ? "" : name.slice(idx);
}

function fileExists(path) {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

function check(files) {
	let violations = 0;
	for (const file of files) {
		if (!SCANNED_EXTENSIONS.has(extname(file))) continue;
		const abs = file.startsWith(sep) ? file : join(REPO_ROOT, file);
		if (!fileExists(abs)) continue;
		const relPathOs = relative(REPO_ROOT, abs);
		if (!isInScannedTree(relPathOs)) continue;
		const relPath = relPathOs.split(sep).join("/");
		const content = readFileSync(abs, "utf8");
		const lines = content.split("\n");
		for (const rule of RULES) {
			if (rule.allow && rule.allow(relPath.replaceAll("/", sep))) continue;
			lines.forEach((line, i) => {
				if (rule.pattern.test(line)) {
					console.error(`${relPath}:${i + 1}  ${rule.message}`);
					console.error(`  > ${line.trim()}`);
					violations++;
				}
			});
		}
	}
	return violations;
}

const argFiles = getFilesFromArgs();
const filesToCheck = argFiles ?? walk(REPO_ROOT, []);
const total = check(filesToCheck);

if (total > 0) {
	console.error(`\nZK check failed: ${total} violation(s).`);
	process.exit(1);
}
