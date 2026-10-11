import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { SourceSerif4_600SemiBold } from "@expo-google-fonts/source-serif-4";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

import { fonts, semantic, space, type } from "./src/theme";

// Register the bundled fonts under the family names the design tokens reference.
const fontAssets = {
  [fonts.display]: SourceSerif4_600SemiBold,
  [fonts.ui]: Inter_400Regular,
  [fonts.uiMedium]: Inter_500Medium,
  [fonts.uiSemibold]: Inter_600SemiBold,
};

// Placeholder screen: proves the scaffold boots with the v2 tokens and fonts.
export default function App() {
  const [fontsLoaded] = useFonts(fontAssets);

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Keeplas</Text>
      <Text style={styles.body}>Mobile app coming soon.</Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semantic["bg.app"],
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    padding: space[6],
  },
  title: {
    fontFamily: fonts.display,
    fontSize: type.h1.fontSize,
    lineHeight: type.h1.lineHeight,
    letterSpacing: type.h1.letterSpacing,
    color: semantic["text.primary"],
  },
  body: {
    fontFamily: fonts.ui,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: semantic["text.muted"],
  },
});
