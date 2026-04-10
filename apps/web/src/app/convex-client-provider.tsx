"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ReactNode, useState } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

let globalClient: ConvexReactClient | null = null;

function getConvexClient(): ConvexReactClient | null {
  if (!convexUrl) return null;
  if (!globalClient) {
    globalClient = new ConvexReactClient(convexUrl);
  }
  return globalClient;
}

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [client] = useState(() => getConvexClient());

  if (!client) {
    return <>{children}</>;
  }

  return (
    <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>
  );
}
