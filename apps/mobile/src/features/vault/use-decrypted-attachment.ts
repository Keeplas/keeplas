import { useCallback, useEffect, useRef, useState } from "react";
import { useNetworkState } from "expo-network";
import type { Id } from "@keeplas/backend/_generated/dataModel";

import {
  classifyFileError,
  errorReference,
  FileProblemError,
  type FileProblem,
} from "@/lib/file-errors";
import {
  cachedDecrypted,
  downloadDecrypted,
  rememberDecrypted,
} from "@/lib/files";

export type AttachmentState =
  | { status: "loading"; progress?: number }
  | { status: "ready"; uri: string }
  | { status: "error"; problem: FileProblem; reference: string };

export interface AttachmentSource {
  id: Id<"vault_item_files">;
  iv: string;
  name: string;
}

/** Short-lived signed URL of a file's ciphertext; null when not allowed. */
export type FileUrl = (
  fileId: Id<"vault_item_files">,
) => Promise<string | null>;

const PARALLEL = 2;
const LOADING: AttachmentState = { status: "loading" };

export function useDecryptedAttachments(
  files: readonly AttachmentSource[],
  key: CryptoKey | undefined,
  fileUrl: FileUrl,
) {
  const network = useNetworkState();
  const online = useRef(network.isInternetReachable);
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [results, setResults] = useState<Record<string, AttachmentState>>({});

  useEffect(() => {
    online.current = network.isInternetReachable;
  }, [network.isInternetReachable]);

  const requests = files.map((file) => ({
    ...file,
    token: `${file.id}:${attempts[file.id] ?? 0}`,
  }));
  const wanted = requests.map((request) => request.token).join(",");
  const pending = useRef(requests);
  const done = useRef(results);
  useEffect(() => {
    pending.current = requests;
    done.current = results;
  });

  useEffect(() => {
    if (!key || !wanted) return;
    let alive = true;

    async function open(request: AttachmentSource & { token: string }) {
      let state: AttachmentState;
      try {
        const cached = cachedDecrypted(request.id);
        if (cached) {
          state = { status: "ready", uri: cached.uri };
        } else {
          const url = await fileUrl(request.id);
          if (!url) throw new FileProblemError("missing");
          let shown = -1;
          const plain = await downloadDecrypted(
            url,
            request.iv,
            key!,
            request.name,
            (ratio) => {
              const pct = Math.floor(ratio * 100);
              if (!alive || pct === shown) return;
              shown = pct;
              setResults((current) => ({
                ...current,
                [request.token]: { status: "loading", progress: ratio },
              }));
            },
          );
          rememberDecrypted(request.id, plain);
          state = { status: "ready", uri: plain.uri };
        }
      } catch (error) {
        const reference = errorReference();
        if (__DEV__) console.warn(`[attachment ${reference}]`, error);
        state = {
          status: "error",
          problem: classifyFileError(error, online.current ?? undefined),
          reference,
        };
      }
      if (alive)
        setResults((current) => ({ ...current, [request.token]: state }));
    }

    const queue = pending.current.filter(
      (request) => !(request.token in done.current),
    );
    void (async () => {
      for (let i = 0; i < queue.length && alive; i += PARALLEL) {
        await Promise.all(queue.slice(i, i + PARALLEL).map(open));
      }
    })();

    return () => {
      alive = false;
    };
  }, [fileUrl, key, wanted]);

  const retry = useCallback(
    (id: string) =>
      setAttempts((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 })),
    [],
  );

  const stateOf = useCallback(
    (id: string): AttachmentState =>
      results[`${id}:${attempts[id] ?? 0}`] ?? LOADING,
    [results, attempts],
  );

  return { stateOf, retry };
}
