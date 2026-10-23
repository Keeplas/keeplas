import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/text";
import { countdownParts } from "@/lib/format";
import { useI18n } from "@/providers/i18n-provider";

const UNITS = ["days", "hours", "minutes", "seconds"] as const;

/** Live DAYS / HOURS / MINUTES / SECONDS countdown to `target`, ticking every second. */
export function Countdown({ target }: { target: number }) {
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const parts = countdownParts(target, now);

  return (
    <View style={styles.row}>
      {UNITS.map((unit) => (
        <View key={unit} style={styles.segment}>
          <Text variant="display" style={styles.digits}>
            {String(parts[unit]).padStart(2, "0")}
          </Text>
          <Text variant="caption" color="text.muted">
            {t(`lifeCheck.countdown.${unit}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between" },
  segment: { alignItems: "center", gap: 4 },
  digits: { fontVariant: ["tabular-nums"] },
});
