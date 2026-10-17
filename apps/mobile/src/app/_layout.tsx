import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { OutboxProvider } from "@/features/outbox/outbox-provider";
import { AccountLanguageSync } from "@/lib/use-change-language";
import { ConvexProvider } from "@/providers/convex-provider";
import { I18nProvider } from "@/providers/i18n-provider";
import { SessionProvider, useSession } from "@/providers/session-provider";
import { ThemeProvider, useTheme } from "@/providers/theme-provider";
import { VaultProvider } from "@/providers/vault-provider";

// Fonts are embedded natively (expo-font config plugin in app.json), so the
// first frame renders with the final type scale. Keep the native splash up
// until the session stage resolves, instead of a blank screen + spinner.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <ConvexProvider>
            <VaultProvider>
              <SessionProvider>
                <OutboxProvider>
                  <AccountLanguageSync />
                  <Routes />
                </OutboxProvider>
              </SessionProvider>
            </VaultProvider>
          </ConvexProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * Each route group is reachable only in its session stage (see
 * lib/session-stage.ts). When a guard closes, Expo Router falls back to
 * `index`, which redirects to the current stage's first screen.
 */
function Routes() {
  const { stage, settingUp } = useSession();
  const { colors } = useTheme();

  useEffect(() => {
    if (stage !== "loading") SplashScreen.hideAsync();
  }, [stage]);

  return (
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
      <Stack.Protected guard={stage === "loginOtp"}>
        <Stack.Screen name="login-otp" />
      </Stack.Protected>
      <Stack.Protected guard={settingUp}>
        <Stack.Screen name="(setup)" />
      </Stack.Protected>
      <Stack.Protected guard={stage === "needsKit"}>
        <Stack.Screen name="recovery-kit" />
        <Stack.Screen name="contact-recovery" />
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
  );
}
