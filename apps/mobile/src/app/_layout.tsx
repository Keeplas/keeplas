import { useEffect, type ReactNode } from "react";
import {
  Stack,
  useGlobalSearchParams,
  usePathname,
  type ErrorBoundaryProps,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BootSplash } from "@/components/boot-splash";
import { ErrorScreen } from "@/components/error-screen";
import { Toaster } from "@/components/toaster";
import { OfflineNotice } from "@/features/offline-notice";
import { OutboxProvider } from "@/features/outbox/outbox-provider";
import { isResumable } from "@/lib/resume-point";
import { AccountLanguageSync } from "@/lib/use-change-language";
import { ConvexProvider } from "@/providers/convex-provider";
import { I18nProvider } from "@/providers/i18n-provider";
import { SessionProvider, useSession } from "@/providers/session-provider";
import { ThemeProvider, useTheme } from "@/providers/theme-provider";
import { VaultProvider } from "@/providers/vault-provider";

// Fonts are embedded natively (expo-font config plugin in app.json), so the
// first frame renders with the final type scale. Keep the native splash up
// until <BootSplash> takes over with the same logo, animated, until the
// session stage resolves.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <DisplayProviders>
      <ConvexProvider>
        <VaultProvider>
          <SessionProvider>
            <OutboxProvider>
              <AccountLanguageSync />
              <ResumeTracker />
              <Routes />
              <Toaster />
            </OutboxProvider>
          </SessionProvider>
        </VaultProvider>
      </ConvexProvider>
    </DisplayProviders>
  );
}

/**
 * A render error anywhere outside (app) lands here instead of closing the
 * app. It replaces the whole tree, so it brings the providers it draws with;
 * Try again starts the app over.
 */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <DisplayProviders>
      <ErrorScreen {...props} />
    </DisplayProviders>
  );
}

function DisplayProviders({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

function ResumeTracker() {
  const { stage, rememberRoute } = useSession();
  const pathname = usePathname();
  const params = JSON.stringify(useGlobalSearchParams());

  useEffect(() => {
    if (stage !== "ready" || !isResumable(pathname)) return;
    rememberRoute(pathname, JSON.parse(params) as Record<string, string>);
  }, [stage, pathname, params, rememberRoute]);

  return null;
}

/**
 * Each route group is reachable only in its session stage (see
 * lib/session-stage.ts). When a guard closes, Expo Router falls back to
 * `index`, which redirects to the current stage's first screen.
 */
function Routes() {
  const { stage, settingUp, resumeReady } = useSession();
  const { colors } = useTheme();
  // Same wait as `index`, so the logo hands straight over to the first screen.
  const booting = stage === "loading" || (stage === "ready" && !resumeReady);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors["bg.app"] },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="invite/[token]" />
        <Stack.Screen name="migrated" />
        {/* Development only: native crypto checks, reachable signed out too. */}
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="self-test" />
        </Stack.Protected>
        <Stack.Protected guard={stage === "signedOut"}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        {/* Lost number: signed out, or stuck before the vault opens. */}
        <Stack.Protected
          guard={
            stage === "signedOut" || stage === "totp" || stage === "needsKit"
          }
        >
          <Stack.Screen name="lost-number" />
        </Stack.Protected>
        <Stack.Protected guard={stage === "newNumber"}>
          <Stack.Screen name="new-number" />
          <Stack.Screen name="new-number-verify" />
        </Stack.Protected>
        <Stack.Protected guard={stage === "loginOtp"}>
          <Stack.Screen name="login-otp" />
        </Stack.Protected>
        <Stack.Protected guard={stage === "totp"}>
          <Stack.Screen name="login-totp" />
          <Stack.Screen name="totp-recovery" />
        </Stack.Protected>
        <Stack.Protected
          guard={stage === "totp" || stage === "needsKit" || stage === "locked"}
        >
          <Stack.Screen name="phone-proof" />
        </Stack.Protected>
        <Stack.Protected guard={settingUp}>
          <Stack.Screen name="(setup)" />
        </Stack.Protected>
        <Stack.Protected guard={stage === "needsKit" || stage === "locked"}>
          <Stack.Screen name="recovery-kit" />
          <Stack.Screen name="cloud-restore" />
          <Stack.Screen name="contact-recovery" />
          <Stack.Screen name="lost-access" />
          <Stack.Screen name="link-from-device" />
        </Stack.Protected>
        <Stack.Protected guard={stage === "locked"}>
          <Stack.Screen name="unlock" />
        </Stack.Protected>
        <Stack.Protected guard={stage === "migration"}>
          <Stack.Screen name="(migration)" />
        </Stack.Protected>
        <Stack.Protected guard={stage === "ready"}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
      <BootSplash visible={booting} />
      {booting ? <OfflineNotice /> : null}
    </>
  );
}
