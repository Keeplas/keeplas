// Public build-time config. Expo inlines `process.env.EXPO_PUBLIC_*` (static
// access only) from apps/mobile/.env.local, which `pnpm link:env` symlinks to
// the root .env.local. See the root .env.example.
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to .env.local (see .env.example).`,
    );
  }
  return value;
}

export const env = {
  convexUrl: required(
    "EXPO_PUBLIC_CONVEX_URL",
    process.env.EXPO_PUBLIC_CONVEX_URL,
  ),
  /** Web app origin: serves /api/context and hosts the /link universal link. */
  appUrl: required(
    "EXPO_PUBLIC_APP_URL",
    process.env.EXPO_PUBLIC_APP_URL,
  ).replace(/\/$/, ""),
  /** Google Cloud project number linked to Play Integrity (Android only). */
  gcpProjectNumber: process.env.EXPO_PUBLIC_GCP_PROJECT_NUMBER ?? "",
};
