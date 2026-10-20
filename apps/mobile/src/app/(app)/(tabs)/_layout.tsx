import { Tabs } from "expo-router";

import { TabBar } from "@/components/tab-bar";
import { useOpenAddSheet } from "@/features/capture/add-sheet";

/** M08-5 tab shell: Home, Search, (+) → M07-1 Add sheet, People, Settings. */
export default function TabsLayout() {
  const openAdd = useOpenAddSheet();
  return (
    <Tabs
      // freezeOnBlur stops re-renders and keeps Convex subscriptions of
      // hidden tabs from doing work (e.g. Settings' usage stats recomputing
      // on every vault change while Home is shown).
      screenOptions={{ headerShown: false, freezeOnBlur: true }}
      tabBar={(props) => (
        <TabBar
          state={props.state}
          navigation={props.navigation}
          onAdd={() => openAdd()}
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
