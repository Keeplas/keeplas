import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useConvex } from "convex/react";

import { Screen } from "@/components/screen";
import { StateMessage } from "@/components/state-message";
import { watchOffline } from "@/lib/offline";
import { useI18n } from "@/providers/i18n-provider";

/**
 * Over the boot splash: a signed-in start waits for the server, so once it
 * has been unreachable for a while, say so instead of animating forever.
 * Convex reconnects on its own and the app opens then; Try again waits once
 * more.
 */
export function OfflineNotice() {
  const convex = useConvex();
  const { t } = useI18n();
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => watchOffline(convex, setOffline), [convex, attempt]);

  if (!offline) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Screen center>
        <StateMessage
          icon="globe"
          tone="info"
          title={t("offline.title")}
          body={t("offline.body")}
          primary={{
            label: t("common.tryAgain"),
            onPress: () => {
              setOffline(false);
              setAttempt((n) => n + 1);
            },
          }}
        />
      </Screen>
    </View>
  );
}
