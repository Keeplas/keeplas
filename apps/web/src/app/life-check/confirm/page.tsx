import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@keeplas/backend/_generated/api";
import { buttonVariants } from "@keeplas/ui";
import { AuthHeroSection } from "../../(auth)/components/auth-hero-section";
import { MobileBrand } from "../../(auth)/components/mobile-brand";

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
      <section className="flex-1 flex items-center justify-center p-8 md:p-10 lg:p-12 xl:p-16 relative bg-surface md:overflow-y-auto">
        <MobileBrand />
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-surface-container-lowest rounded-full mb-4 shadow-sm">
              <span className="text-label-md text-primary">Life Check</span>
            </div>
            <h3 className="text-headline-md text-primary mb-2">
              {ok
                ? "Thanks — you're confirmed"
                : "This link is invalid or expired"}
            </h3>
            <p className="text-body-md text-on-surface-variant">
              {ok
                ? "We've recorded that you're well and reset your check-in countdown. You can safely close this tab."
                : "This confirmation link is invalid or has expired. Open Keeplas to confirm from the Life Check page, or wait for the next check-in."}
            </p>
          </div>
          <Link
            href="/life-check"
            className={buttonVariants({
              variant: "vault",
              size: "md",
              className: "w-full",
            })}
          >
            Open Keeplas
          </Link>
        </div>
      </section>
    </main>
  );
}
