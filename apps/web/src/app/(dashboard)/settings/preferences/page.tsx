import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { ErrorAlert, Loader } from "@keeplas/ui";
import { PreferencesSection } from "../sections/preferences-section";

export default function SettingsPreferencesPage() {
  const user = useQuery(api.users.viewer);
  const [error, setError] = useState("");

  if (user === undefined) return <Loader />;
  if (user === null) return null;

  return (
    <div className="space-y-6">
      {error && <ErrorAlert message={error} />}
      <PreferencesSection user={user} onError={setError} />
    </div>
  );
}
