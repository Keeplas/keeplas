"use node";

import { v } from "convex/values";
import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { verifyBytes } from "@keeplas/crypto/sig";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { vaultProofMessage } from "./lib/vault_proof";

/**
 * The identity key's signature over {@link vaultProofMessage}: the identity
 * secret is wrapped under the MasterKey, so only a client that opened the
 * vault can produce it. Grants this session the "vault" proof
 * (session_proofs.ts); the nonce is spent on any answer (no replay).
 */
export const proveVault = action({
  args: { signature: v.string() },
  handler: async (ctx, { signature }): Promise<{ success: boolean }> => {
    const userId = await getAuthUserId(ctx);
    const sessionId = await getAuthSessionId(ctx);
    if (!userId || !sessionId) throw new Error("Not authenticated");
    const challenge = await ctx.runMutation(
      internal.session_proofs.takeVaultChallenge,
      { sessionId, userId },
    );
    if (
      !challenge ||
      !verifyBytes(
        challenge.identityPublicKey,
        vaultProofMessage(userId, challenge.nonce),
        signature,
      )
    ) {
      return { success: false };
    }
    await ctx.runMutation(internal.session_proofs.grantVaultProof, {
      sessionId,
      userId,
    });
    return { success: true };
  },
});
