import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";

import { STAGE_HOME } from "@/lib/session-stage";
import { useSession } from "@/providers/session-provider";
import { useTheme } from "@/providers/theme-provider";

/** Redirect hub: sends the user to the first screen of the current stage. */
export default function Index() {
  const { stage, settingUp, resumeReady } = useSession();
  const { colors } = useTheme();
  if (stage === "loading" || (stage === "ready" && !resumeReady)) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors["bg.app"],
        }}
      >
        <ActivityIndicator color={colors["text.muted"]} />
      </View>
    );
  }
  return (
    <Redirect
      href={stage === "ready" && settingUp ? "/contacts" : STAGE_HOME[stage]}
    />
  );
}
