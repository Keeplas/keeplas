import { Linking } from "react-native";

const SUPPORT_EMAIL = "support@keeplas.com";

/** Open a support email, with a reference in the subject when given. */
export function contactSupport(subject?: string): Promise<void> {
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";
  return Linking.openURL(`mailto:${SUPPORT_EMAIL}${query}`);
}
