import { Alert } from "react-native";
import { Tabs } from "expo-router";

import { TabBar } from "@/components/tab-bar";
import { useI18n } from "@/providers/i18n-provider";

/** M08-5 tab shell: Home, Search, (+), People, Settings. */
export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <TabBar
          state={props.state}
          navigation={props.navigation}
          // Capture (M07) arrives with the next part.
          onAdd={() => Alert.alert(t("nav.add"), t("common.comingSoon"))}
        />
      )}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="people" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
