import { Tabs } from "expo-router";

import { useReportActiveTab } from "@/features/navigation/tab-shell";
import { isTabName } from "@/features/navigation/tab-routes";

/** M08-5 tab shell: the bar itself lives in TabShell so it stays on every screen. */
export default function TabsLayout() {
  const report = useReportActiveTab();
  return (
    <Tabs
      // freezeOnBlur stops re-renders and keeps Convex subscriptions of
      // hidden tabs from doing work (e.g. Settings' usage stats recomputing
      // on every vault change while Home is shown).
      screenOptions={{ headerShown: false, freezeOnBlur: true }}
      tabBar={() => null}
      screenListeners={({ route }) => ({
        focus: () => {
          if (isTabName(route.name)) report(route.name);
        },
      })}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="people" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
