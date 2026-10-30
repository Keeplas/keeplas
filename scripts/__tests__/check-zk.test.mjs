// Run with `node --test "scripts/__tests__/*.test.mjs"` (CI runs it next to check:zk).
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "check-zk.mjs");

/** Runs check-zk --all over a throwaway tree of `files` (path → content). */
function checkTree(files) {
	const root = mkdtempSync(join(tmpdir(), "check-zk-"));
	try {
		for (const [path, content] of Object.entries(files)) {
			mkdirSync(join(root, dirname(path)), { recursive: true });
			writeFileSync(join(root, path), content);
		}
		const run = spawnSync(process.execPath, [SCRIPT, "--all"], {
			cwd: root,
			encoding: "utf8",
		});
		return { status: run.status, output: run.stderr };
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

test("flags every way of reaching the Shamir split outside crypto/social", () => {
	const bypasses = {
		"apps/web/src/subpath.ts": 'import { split } from "@keeplas/crypto/shamir";\n',
		"apps/web/src/suffix.ts": 'import { split } from "@keeplas/crypto/shamir/index";\n',
		"apps/web/src/dynamic.ts": 'const m = await import("@keeplas/crypto/shamir");\n',
		"apps/web/src/multiline.ts": 'const m = await import(\n  "@keeplas/crypto/shamir"\n);\n',
		"apps/mobile/src/require.ts": 'const m = require("@keeplas/crypto/shamir");\n',
		"apps/mobile/src/relative.ts":
			'import { split } from "../../../packages/crypto/src/shamir";\n',
		"apps/mobile/modules/native.ts": 'export * from "@keeplas/crypto/shamir";\n',
		"packages/convex/lib/x.ts": 'export { split } from "@keeplas/crypto/shamir";\n',
		"packages/crypto/src/index.ts": 'export * from "./shamir";\n',
		"packages/crypto/package.json": JSON.stringify({
			exports: { "./shamir": "./src/shamir/index.ts" },
		}),
	};
	const { status, output } = checkTree(bypasses);
	assert.equal(status, 1);
	for (const path of Object.keys(bypasses)) {
		assert.match(output, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
	}
});

test("lets the social module and the Shamir tests use it", () => {
	const { status, output } = checkTree({
		"packages/crypto/src/social/index.ts": 'import { split } from "../shamir";\n',
		"packages/crypto/__tests__/shamir.test.ts": 'import { split } from "../src/shamir";\n',
		"packages/crypto/src/index.ts": 'export * from "./social";\n',
		"apps/web/src/docs.tsx": 'const doc = { key: "shamir" };\n',
	});
	assert.equal(output, "");
	assert.equal(status, 0);
});

test("flags a recovery-phrase verifier compared with == / ===", () => {
	const { status, output } = checkTree({
		"packages/convex/a.ts": "if (args.phraseHash === user.recoveryPhraseHash) ok();\n",
		"packages/convex/b.ts": "if (user.recoveryPhraseHash == args.phraseHash) ok();\n",
		"packages/convex/ok.ts": "if (args.phraseHash === undefined) return;\n",
	});
	assert.equal(status, 1);
	assert.match(output, /packages\/convex\/a\.ts:1/);
	assert.match(output, /packages\/convex\/b\.ts:1/);
	assert.doesNotMatch(output, /ok\.ts/);
});
