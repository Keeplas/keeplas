import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { Loader } from "@keeplas/ui";
import { api } from "@keeplas/backend/_generated/api";
import { AuthHeroSection } from "../../(auth)/components/auth-hero-section";
import { ConfirmResult } from "./confirm-result";
import { useSearchParams } from "@/lib/navigation";

type ConfirmStatus = "ok" | "invalid";

/**
 * Unauthenticated landing for the one-click email confirmation. When the email
 * link is clicked, this page calls the Convex action to verify the HMAC token
 * and reset the liveness timer, then renders the outcome — keeping the visible
 * URL on the Keeplas domain (the action call is an XHR to Convex).
 */
export default function LifeCheckConfirmPage() {
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const token = searchParams.get("token");
  const confirm = useAction(api.life_check.confirmFromEmailToken);

  const initial: ConfirmStatus | undefined =
    statusParam === "ok" || statusParam === "invalid" ? statusParam : undefined;
  const [resolved, setResolved] = useState<ConfirmStatus | undefined>(initial);
  const [pending, setPending] = useState(initial === undefined && !!token);

  useEffect(() => {
    if (initial !== undefined || !token) return;
    let active = true;
    void (async () => {
      try {
        const result = await confirm({ token });
        if (active) setResolved(result);
      } catch {
        if (active) setResolved("invalid");
      } finally {
        if (active) setPending(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [initial, token, confirm]);

  if (pending) {
    return (
      <main className="min-h-screen md:h-screen md:overflow-hidden flex flex-col md:flex-row">
        <AuthHeroSection />
        <Loader fullscreen />
      </main>
    );
  }

  return (
    <main className="min-h-screen md:h-screen md:overflow-hidden flex flex-col md:flex-row">
      <AuthHeroSection />
      <ConfirmResult ok={resolved === "ok"} />
    </main>
  );
}
