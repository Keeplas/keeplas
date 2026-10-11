// Per-weight entry points: only these four files are bundled.
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { SourceSerif4_600SemiBold } from "@expo-google-fonts/source-serif-4/600SemiBold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AccountLanguageSync } from "@/lib/use-change-language";
import { ConvexProvider } from "@/providers/convex-provider";
import { I18nProvider } from "@/providers/i18n-provider";
import { SessionProvider, useSession } from "@/providers/session-provider";
import { ThemeProvider, useTheme } from "@/providers/theme-provider";
import { useVault, VaultProvider } from "@/providers/vault-provider";
import { fonts } from "@/theme";

// Register the bundled fonts under the family names the type scale uses.
const fontAssets = {
  [fonts.display]: SourceSerif4_600SemiBold,
  [fonts.ui]: Inter_400Regular,
  [fonts.uiMedium]: Inter_500Medium,
  [fonts.uiSemibold]: Inter_600SemiBold,
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontAssets);
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <ConvexProvider>
            <VaultProvider>
              <SessionProvider>
                <AccountLanguageSync />
                <Routes />
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
  const { stage } = useSession();
  const { setupPhrase } = useVault();
  const { colors } = useTheme();
  const settingUp = stage === "setup" || setupPhrase !== null;

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
