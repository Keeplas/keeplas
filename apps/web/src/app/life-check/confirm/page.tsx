import { ConvexHttpClient } from "convex/browser";
import { api } from "@keeplas/backend/_generated/api";
import { AuthHeroSection } from "../../(auth)/components/auth-hero-section";
import { ConfirmResult } from "./confirm-result";

/**
 * Unauthenticated landing for the one-click email confirmation. When the email
 * link is clicked, this page calls the Convex action server-side to verify the
 * HMAC token and reset the liveness timer, then renders the outcome — keeping
 * the visible URL on the Keeplas domain (no Convex deployment leak).
 */
export default async function LifeCheckConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; token?: string }>;
}) {
  const { status, token } = await searchParams;

  let resolvedStatus: "ok" | "invalid" | undefined =
    status === "ok" || status === "invalid" ? status : undefined;

  if (!resolvedStatus && token) {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      resolvedStatus = "invalid";
    } else {
      try {
        const client = new ConvexHttpClient(convexUrl);
        resolvedStatus = await client.action(
          api.life_check.confirmFromEmailToken,
          { token },
        );
      } catch {
        resolvedStatus = "invalid";
      }
    }
  }

  const ok = resolvedStatus === "ok";

  return (
    <main className="min-h-screen md:h-screen md:overflow-hidden flex flex-col md:flex-row">
      <AuthHeroSection />
      <ConfirmResult ok={ok} />
    </main>
  );
}
