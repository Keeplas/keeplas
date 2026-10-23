import { router } from "expo-router";

/** Topics of support.submitTicket (packages/convex/support.ts). */
export const SUPPORT_TOPICS = [
  "general",
  "recovery",
  "security",
  "billing",
  "feature_request",
  "other",
] as const;

export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

/**
 * Open the support form. `ref` (an error detail, a request id) is appended
 * to the message so the team can diagnose without asking.
 */
export function contactSupport(ref?: string, topic?: SupportTopic): void {
  router.push({
    pathname: "/support",
    params: { ...(ref ? { ref } : {}), ...(topic ? { topic } : {}) },
  });
}
