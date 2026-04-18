"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader } from "@keeplas/ui";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <Loader fullscreen />;
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <>
      {children}
      {/* Decorative floating blur elements */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-secondary/5 blur-[120px] pointer-events-none rounded-full" />
      <div className="fixed bottom-0 left-0 w-96 h-96 bg-primary/5 blur-[120px] pointer-events-none rounded-full" />
    </>
  );
}
