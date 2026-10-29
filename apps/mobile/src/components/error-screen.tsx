import type { ErrorBoundaryProps } from "expo-router";

import { useI18n } from "@/providers/i18n-provider";
import { Screen } from "./screen";
import { StateMessage } from "./state-message";

/**
 * What a route's `ErrorBoundary` export shows when its screens throw while
 * rendering: a recoverable message instead of a closed app. Try again
 * renders the route again.
 */
export function ErrorScreen({ retry }: ErrorBoundaryProps) {
  const { t } = useI18n();
  return (
    <Screen center>
      <StateMessage
        icon="alert-triangle"
        tone="warning"
        title={t("crash.title")}
        body={t("crash.body")}
        primary={{ label: t("common.tryAgain"), onPress: () => void retry() }}
      />
    </Screen>
  );
}
