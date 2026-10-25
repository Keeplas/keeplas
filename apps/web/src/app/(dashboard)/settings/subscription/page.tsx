import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { SubscriptionView } from "./subscription-view";

export default function SubscriptionPage() {
  const viewer = useQuery(api.users.viewer);
  return (
    <SubscriptionView
      currentPlan={viewer ? (viewer.plan ?? "free") : undefined}
    />
  );
}
