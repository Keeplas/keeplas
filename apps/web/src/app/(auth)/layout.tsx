"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="w-8 h-8 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
      </div>
    );
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
