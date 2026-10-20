import { useCallback, useEffect, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { useNetworkState } from "expo-network";
import type { File } from "expo-file-system";
import { api } from "@keeplas/backend/_generated/api";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import {
  classifyFileError,
  errorReference,
  FileProblemError,
  type FileProblem,
} from "@/lib/file-errors";
import { downloadDecrypted } from "@/lib/files";

export type AttachmentState =
  | { status: "loading" }
  | { status: "ready"; uri: string }
  | { status: "error"; problem: FileProblem; reference: string };

export function useDecryptedAttachment(
  fileId: Id<"vault_item_files"> | undefined,
  iv: string | undefined,
  name: string,
  key: CryptoKey | undefined,
) {
  const convex = useConvex();
  const network = useNetworkState();
  const online = useRef(network.isInternetReachable);
  const [attempt, setAttempt] = useState(0);
  const request = `${fileId}:${attempt}`;
  const [result, setResult] = useState<{
    request: string;
    state: AttachmentState;
  }>();

  useEffect(() => {
    online.current = network.isInternetReachable;
  }, [network.isInternetReachable]);

  useEffect(() => {
    if (!fileId || !iv || !key) return;
    let alive = true;
    let plain: File | null = null;
    const done = (state: AttachmentState) => setResult({ request, state });
    void (async () => {
      try {
        const url = await convex.query(api.vault_items.getItemFileUrl, {
          fileId,
        });
        if (!url) throw new FileProblemError("missing");
        plain = await downloadDecrypted(url, iv, key, name);
        if (alive) done({ status: "ready", uri: plain.uri });
        else plain.delete();
      } catch (error) {
        const reference = errorReference();
        if (__DEV__) console.warn(`[attachment ${reference}]`, error);
        if (alive)
          done({
            status: "error",
            problem: classifyFileError(error, online.current ?? undefined),
            reference,
          });
      }
    })();
    return () => {
      alive = false;
      if (plain?.exists) plain.delete();
    };
  }, [convex, fileId, iv, name, key, request]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const state: AttachmentState =
    result?.request === request ? result.state : { status: "loading" };
  return { state, retry };
}
