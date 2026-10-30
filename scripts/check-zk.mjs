#!/usr/bin/env node
/**
 * Zero-knowledge invariant checks. Runs as a pre-commit hook against the
 * staged files, and over every tracked file with `pnpm check:zk --all`
 * (CI). See RULES for the invariants, e.g.:
 *  - Vault items must never be created or updated with `accessLevel: "public"`.
 *    Public access would imply unencrypted data on Emergency Card QRs.
 *  - Convex `ctx.storage.*` calls and any mention of the `_storage` table
 *    (`Id<"_storage">`, `v.id("_storage")`, system-table reads) must only
 *    appear inside `packages/convex/lib/storage.ts`. The wrapper exists so we
 *    can swap S3 / GCS / R2 without rewriting every domain file
 *    (docs/STORAGE_MIGRATION.md).
 *  - The MasterKey is never split: only the social-recovery module may reach
 *    the Shamir code, by any import form, and the crypto package must not
 *    export it.
 *
 * Patterns are matched against the whole file, so a match may span lines.
 * Exits with code 1 if anything matched, printing path + line number.
 */
import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { readdirSync } from "node:fs";

const REPO_ROOT = process.cwd();
const STORAGE_WRAPPER_REL = join("packages", "convex", "lib", "storage.ts");
const CRYPTO_PACKAGE_JSON = join("packages", "crypto", "package.json");

// Only source paths we control. Skipping scripts/, docs/, and node_modules
// keeps documentation comments and tooling out of the regex window.
const SCANNED_PREFIXES = [
	join("apps", "web", "src"),
	join("apps", "mobile", "src"),
	join("apps", "mobile", "modules"),
	join("packages", "convex"),
	join("packages", "crypto"),
	join("packages", "ui"),
];

// The only code that may import the Shamir split (it splits the recovery
// secret RS, never the MasterKey), plus the split's own code and tests.
const SHAMIR_ALLOWED = [
	join("packages", "crypto", "src", "shamir") + sep,
	join("packages", "crypto", "src", "social") + sep,
	join("packages", "crypto", "__tests__", "shamir.test.ts"),
];

function isClientPath(relPath) {
	return (
		relPath.startsWith(join("apps", "web")) ||
		relPath.startsWith(join("apps", "mobile"))
	);
}

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
		pattern: /["']_storage["']/,
		message:
			'The "_storage" table belongs to packages/convex/lib/storage.ts — use StorageRef / storageRefValidator.',
		allow: (relPath) => relPath === STORAGE_WRAPPER_REL,
	},
	{
		// Convex V8 code must use the local ./lib/crypto helper, never the
		// browser crypto package (it pulls WebCrypto-only modules and breaks the
		// convex bundle/typecheck). See packages/convex/lib/crypto.ts. Node
		// actions (`*_node.ts`, "use node") and tests may reuse its envelopes.
		pattern: /from\s+["']@keeplas\/crypto(\/[a-z-]+)?["']/,
		message:
			"Convex V8 code must not import @keeplas/crypto. Use packages/convex/lib/crypto.ts (only \"use node\" *_node.ts actions and tests may).",
		allow: (relPath) =>
			!relPath.startsWith(join("packages", "convex")) ||
			relPath.endsWith("_node.ts") ||
			relPath.includes(`${sep}__tests__${sep}`),
	},
	{
		// WebAuthn must demand user verification (finding #6) — no possession-only.
		pattern: /userVerification\s*:\s*["']preferred["']/,
		message:
			'WebAuthn userVerification must be "required", not "preferred" (finding #6).',
	},
	{
		pattern: /requireUserVerification\s*:\s*false/,
		message:
			"WebAuthn requireUserVerification must be true (finding #6).",
	},
	{
		// Life Check must default to "abort", never auto-release on silence (H1).
		pattern: /\?\?\s*["']release_anyway["']/,
		message:
			'fallbackBehavior must default to "abort", never "release_anyway" (finding H1).',
	},
	{
		// v2 F1/F2: the MasterKey is never Shamir-split — no code may split it
		// or rebuild it from contact shards. Owner recovery (phase 5) splits a
		// separate recovery secret and must not reopen this path. Any module
		// specifier naming shamir counts: import / export … from, side-effect
		// import, dynamic import(), require(), package or relative path.
		pattern: /\b(?:from|import|require)\s*\(?\s*["'`][^"'`\n]*shamir/i,
		message:
			"Only packages/crypto/src/social may import the Shamir split — the MasterKey is never split (v2 F1/F2).",
		allow: (relPath) =>
			SHAMIR_ALLOWED.some((allowed) =>
				allowed.endsWith(sep) ? relPath.startsWith(allowed) : relPath === allowed,
			),
	},
	{
		// v2 F5: a missed Life Check never releases — the client must not offer it.
		pattern: /release_anyway/,
		message:
			'"release_anyway" is retired (v2 F5) — a missed Life Check never releases.',
		allow: (relPath) => !isClientPath(relPath),
	},
	{
		// The recovery-phrase verifier must be compared in constant time (M1).
		// Either side of == / === / != / !==; a check against undefined or
		// null is not a comparison of the verifier.
		pattern:
			/\b(?:recoveryP|p)hraseHash\b\s*[!=]==?(?!=)(?!\s*(?:undefined|null)\b)|[!=]==?\s*[\w.?!]*\b(?:recoveryP|p)hraseHash\b/,
		message:
			"Compare the recovery-phrase verifier with constantTimeStringEquals, not == / !== (finding M1).",
	},
];

const SCANNED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const IGNORED_DIRS = new Set([
	"node_modules",
	"dist",
	".output",
	".turbo",
	"_generated",
	".git",
	"dist",
	"build",
]);

const FULL_SCAN = process.argv.includes("--all");

function getFilesFromArgs() {
	const fromCli = process.argv.slice(2).filter((a) => a && a !== "--all");
	if (fromCli.length > 0) return fromCli;
	if (FULL_SCAN) return null;

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

/** Whole repo: the tracked files, or a walk outside a git checkout. */
function allFiles() {
	try {
		return execSync("git ls-files", { encoding: "utf8", stdio: "pipe" })
			.split("\n")
			.filter(Boolean);
	} catch {
		return walk(REPO_ROOT, []);
	}
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

/** The crypto package must not export the Shamir split (v2 F1/F2). */
function checkCryptoExports() {
	const abs = join(REPO_ROOT, CRYPTO_PACKAGE_JSON);
	if (!fileExists(abs)) return 0;
	const exported = Object.keys(
		JSON.parse(readFileSync(abs, "utf8")).exports ?? {},
	).filter((path) => /shamir/i.test(path));
	for (const path of exported) {
		console.error(
			`${CRYPTO_PACKAGE_JSON.split(sep).join("/")}  "${path}" exports the Shamir split — keep it internal to the social module (v2 F1/F2).`,
		);
	}
	return exported.length;
}

function check(files) {
	let violations = checkCryptoExports();
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
			if (rule.allow && rule.allow(relPathOs)) continue;
			const global = new RegExp(rule.pattern.source, `${rule.pattern.flags}g`);
			for (const match of content.matchAll(global)) {
				const line = content.slice(0, match.index).split("\n").length;
				console.error(`${relPath}:${line}  ${rule.message}`);
				console.error(`  > ${lines[line - 1].trim()}`);
				violations++;
			}
		}
	}
	return violations;
}

const argFiles = getFilesFromArgs();
const filesToCheck = argFiles ?? allFiles();
const total = check(filesToCheck);

if (total > 0) {
	console.error(`\nZK check failed: ${total} violation(s).`);
	process.exit(1);
}
