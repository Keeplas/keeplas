import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ReactNode, useState } from "react";
import { ConfirmDialogProvider } from "@keeplas/ui";
import { MasterKeyProvider } from "@/lib/master-key-context";
import { I18nProvider, ViewerLocaleSync } from "@/lib/i18n";
import { PageViewTracker } from "@/lib/page-view-tracker";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

let globalClient: ConvexReactClient | null = null;

function getConvexClient(): ConvexReactClient | null {
  if (!convexUrl) return null;
  if (!globalClient) {
    globalClient = new ConvexReactClient(convexUrl);
  }
  return globalClient;
}

export default function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => getConvexClient());

  if (!client) {
    return (
      <I18nProvider>
        <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
      </I18nProvider>
    );
  }

  return (
    <ConvexAuthProvider client={client}>
      <I18nProvider>
        <ViewerLocaleSync />
        <PageViewTracker />
        <MasterKeyProvider>
          <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
        </MasterKeyProvider>
      </I18nProvider>
    </ConvexAuthProvider>
  );
}
