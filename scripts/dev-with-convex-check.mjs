#!/usr/bin/env node
// Runs `turbo run dev` in the foreground and `pnpm check:convex-env` in the
// background. The convex check takes ~30s to round-trip with the deployment;
// we don't want that to block boot. On mismatch we print a yellow warning,
// but we NEVER propagate a non-zero exit code into the dev process.

import { spawn } from "node:child_process";

const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

// Skip the background check in CI — it's only useful for local devs.
const skipCheck =
  process.env.CI === "true" || process.env.KEEPLAS_SKIP_CONVEX_CHECK === "1";

if (!skipCheck) {
  const check = spawn("pnpm", ["check:convex-env"], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  let stdout = "";
  let stderr = "";
  check.stdout.on("data", (chunk) => (stdout += chunk));
  check.stderr.on("data", (chunk) => (stderr += chunk));

  check.on("exit", (code) => {
    if (code === 0) {
      console.log(`${DIM}${GREEN}✓${RESET}${DIM} convex env in sync${RESET}`);
      return;
    }
    console.log(
      `\n${YELLOW}⚠ convex env check found drift (dev server is unaffected):${RESET}`,
    );
    const tail = (stdout + stderr)
      .split("\n")
      .filter((l) => l.trim())
      .slice(-12)
      .join("\n");
    console.log(tail);
    console.log(
      `${DIM}Fix with: ${RESET}${YELLOW}pnpm sync:convex-env${RESET}${DIM} — then re-run pnpm dev.${RESET}\n`,
    );
  });

  check.on("error", () => {
    // swallow — never break dev
  });
}

const dev = spawn("turbo", ["run", "dev"], { stdio: "inherit" });
dev.on("exit", (code) => process.exit(code ?? 0));

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => dev.kill(sig));
}
