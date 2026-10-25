import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";

import { Callout } from "@/components/surfaces";
import { useI18n } from "@/providers/i18n-provider";

/**
 * Warns the owner when fewer people accepted than must confirm they can't be
 * reached: below that threshold nothing can ever be passed on.
 */
export function ReleaseQuorumWarning() {
  const { t } = useI18n();
  const quorum = useQuery(api.trusted_contacts.getReleaseQuorum);
  if (!quorum || quorum.available >= quorum.required) return null;
  return (
    <Callout
      tone="warning"
      icon="alert-triangle"
      text={t("people.quorumWarning", {
        required: quorum.required,
        available: quorum.available,
      })}
    />
  );
}
