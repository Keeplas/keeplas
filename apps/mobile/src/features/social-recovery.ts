import { useCallback, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { createSocialRecovery } from "@keeplas/crypto/social";

import { useVerifiedKey } from "@/features/vault/use-contact-trust";
import {
  needsSocialRecoverySetup,
  targetKeyMaterial,
} from "@/lib/social-recovery-policy";
import { useAuditedAction } from "@/lib/use-audited-action";
import { useViewer } from "@/providers/session-provider";
import { useVault } from "@/providers/vault-provider";

export function useSealSocialRecovery() {
  const viewer = useViewer();
  const { exportRawMasterKey } = useVault();
  const targets = useQuery(api.recovery.getSetupTargets);
  const myRequest = useQuery(api.recovery.getMyRequest);
  const verifiedKey = useVerifiedKey();
  const setup = useAuditedAction(api.recovery_node.setup);

  const seal = useCallback(async () => {
    if (!targets) return;
    const masterKey = await exportRawMasterKey();
    try {
      const contacts = await Promise.all(
        targets.contacts.map(async (contact) => ({
          contactId: contact.contactId,
          publicKey: await verifiedKey(targetKeyMaterial(contact)),
        })),
      );
      const material = await createSocialRecovery({
        masterKey,
        userId: viewer._id,
        generation: targets.nextGeneration,
        contacts,
      });
      await setup({
        ...material,
        shares: material.shares.map((share) => ({
          ...share,
          contactId:
            share.contactId as (typeof targets.contacts)[number]["contactId"],
        })),
        completesRequestId:
          myRequest?.status === "released" ? myRequest.requestId : undefined,
      });
    } finally {
      masterKey.fill(0);
    }
  }, [targets, myRequest, exportRawMasterKey, verifiedKey, setup, viewer._id]);

  return { targets, seal };
}

export function useEnsureSocialRecovery() {
  const health = useQuery(api.recovery.getHealth);
  const { targets, seal } = useSealSocialRecovery();
  const tried = useRef<string | null>(null);

  useEffect(() => {
    if (!needsSocialRecoverySetup(health, targets) || !targets) return;
    const attempt = [
      targets.nextGeneration,
      ...targets.contacts.map((c) => c.contactId),
    ].join(":");
    if (tried.current === attempt) return;
    tried.current = attempt;
    seal().catch(() => undefined);
  }, [health, targets, seal]);
}
