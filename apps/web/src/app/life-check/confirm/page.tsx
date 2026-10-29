import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { AuthHeroSection } from "../../(auth)/components/auth-hero-section";
import { ConfirmPrompt, ConfirmResult } from "./confirm-result";
import { useSearchParams } from "@/lib/navigation";

type ConfirmStatus = "ok" | "invalid";

/**
 * Unauthenticated landing for the one-click email confirmation. Opening the
 * link changes nothing: mail scanners and link previews load it with no person
 * behind it. The user presses "I'm well", which calls the Convex action to
 * verify the HMAC token and answer the check-in, then the outcome renders —
 * keeping the visible URL on the Keeplas domain (the action call is an XHR to
 * Convex).
 */
export default function LifeCheckConfirmPage() {
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const token = searchParams.get("token");
  const confirm = useAction(api.life_check.confirmFromEmailToken);

  const initial: ConfirmStatus | undefined =
    statusParam === "ok" || statusParam === "invalid"
      ? statusParam
      : token
        ? undefined
        : "invalid";
  const [resolved, setResolved] = useState<ConfirmStatus | undefined>(initial);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    if (!token) return;
    setPending(true);
    try {
      setResolved(await confirm({ token }));
    } catch {
      setResolved("invalid");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen md:h-screen md:overflow-hidden flex flex-col md:flex-row">
      <AuthHeroSection />
      {resolved === undefined ? (
        <ConfirmPrompt
          pending={pending}
          onConfirm={() => void handleConfirm()}
        />
      ) : (
        <ConfirmResult ok={resolved === "ok"} />
      )}
    </main>
  );
}
