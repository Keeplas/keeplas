/**
 * Reads a Convex deployment env var, throwing a clear, actionable error if it
 * is missing. Pre-flight (`pnpm check:convex-env`) prevents this from firing
 * in normal use; this helper is the safety net for "key was unset on the
 * deployment after boot" or for self-hosted environments without the script.
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `Convex env \`${key}\` is missing. Run \`pnpm sync:convex-env\` from the repo root to push it from your local env files.`,
    );
  }
  return value;
}
