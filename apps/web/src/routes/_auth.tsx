import {
  Outlet,
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { useEffect } from "react";
import { Loader } from "@keeplas/ui";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { redirect?: string };

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const redirect = search.redirect;
      // Only honor relative paths to prevent open-redirect.
      const target =
        redirect && redirect.startsWith("/") && !redirect.startsWith("//")
          ? redirect
          : "/hub";
      navigate({ to: target as "/hub" });
    }
  }, [isAuthenticated, isLoading, navigate, search.redirect]);

  if (isLoading) {
    return <Loader fullscreen />;
  }

  if (isAuthenticated) {
    return null;
  }

  return <Outlet />;
}
