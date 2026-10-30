import { useEffect } from "react";
import { AccessibilityInfo } from "react-native";

import { Text } from "./text";

/**
 * Inline error under a field or an action (wrong PIN, invalid number).
 * Screen readers announce it when it appears and each time it changes,
 * queued after what they are saying (the typed digit). Renders nothing
 * without a message.
 */
export function ErrorText({
  children,
  align,
}: {
  children: string | null | undefined;
  align?: "center";
}) {
  useEffect(() => {
    if (children) {
      AccessibilityInfo.announceForAccessibilityWithOptions(children, {
        queue: true,
      });
    }
  }, [children]);

  if (!children) return null;
  return (
    <Text variant="body-sm" color="status.revoked" align={align}>
      {children}
    </Text>
  );
}
