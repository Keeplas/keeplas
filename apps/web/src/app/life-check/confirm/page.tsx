import Link from "next/link";
import { buttonVariants } from "@keeplas/ui";
import { AuthHeroSection } from "../../(auth)/components/auth-hero-section";
import { MobileBrand } from "../../(auth)/components/mobile-brand";

/**
 * Unauthenticated landing for the one-click email confirmation. The Convex HTTP
 * action (see packages/convex/http.ts) has already performed the confirmation
 * and redirected here with `?status=ok|invalid` — this page just reports the
 * outcome, so a user can confirm they're well without ever logging in.
 */
export default async function LifeCheckConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const ok = status === "ok";

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
