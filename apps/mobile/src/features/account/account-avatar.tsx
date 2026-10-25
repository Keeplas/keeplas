import { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { useTheme } from "@/providers/theme-provider";

export function AccountAvatar({
  url,
  name,
  size,
  busy = false,
}: {
  url?: string;
  name: string;
  size: number;
  busy?: boolean;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState<string | null>(null);
  const shape = { width: size, height: size, borderRadius: size / 2 };
  const showImage = url && failed !== url;
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <View
      style={[
        styles.frame,
        shape,
        {
          backgroundColor: colors["bg.info"],
          borderColor: colors["border.default"],
        },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: url }}
          style={shape}
          onError={() => setFailed(url)}
          accessibilityIgnoresInvertColors
        />
      ) : initial ? (
        <Text variant={size >= 72 ? "h1" : "h3"} color="accent">
          {initial}
        </Text>
      ) : (
        <Icon name="user" size={Math.round(size * 0.44)} color="accent" />
      )}
      {busy ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.center,
            { backgroundColor: colors["bg.subtle"] },
          ]}
        >
          <ActivityIndicator color={colors["text.muted"]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
  },
  center: { alignItems: "center", justifyContent: "center" },
});
