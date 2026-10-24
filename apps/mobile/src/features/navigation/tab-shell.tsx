import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, View } from "react-native";
import { usePathname, useRouter } from "expo-router";

import { TabBar, TabBarVisibleContext } from "@/components/tab-bar";
import { useOpenAddSheet } from "@/features/capture/add-sheet";
import { filterPreset } from "@/features/vault/vault-filter";
import { categoryOfPath, showsTabBar, type TabName } from "./tab-routes";

const ReportTabContext = createContext<(tab: TabName) => void>(() => undefined);

export const useReportActiveTab = () => useContext(ReportTabContext);

export function TabShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const openAdd = useOpenAddSheet();
  const [active, setActive] = useState<TabName>("home");
  const visible = showsTabBar(pathname);
  const category = categoryOfPath(pathname);

  const select = useCallback(
    (tab: TabName) => {
      if (router.canDismiss()) router.dismissAll();
      router.navigate(`/${tab}`);
    },
    [router],
  );

  return (
    <ReportTabContext.Provider value={setActive}>
      <TabBarVisibleContext.Provider value={visible}>
        <View style={styles.flex}>{children}</View>
        {visible ? (
          <TabBar
            active={active}
            onSelect={select}
            onAdd={() => openAdd(category ? filterPreset(category) : undefined)}
          />
        ) : null}
      </TabBarVisibleContext.Provider>
    </ReportTabContext.Provider>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
