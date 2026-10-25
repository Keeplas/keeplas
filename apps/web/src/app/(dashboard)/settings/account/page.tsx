import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Loader } from "@keeplas/ui";
import { IdentitySection } from "../sections/identity-section";

export default function SettingsIdentityPage() {
  const user = useQuery(api.users.viewer);

  if (user === undefined) return <Loader />;
  if (user === null) return null;

  return <IdentitySection user={user} />;
}
