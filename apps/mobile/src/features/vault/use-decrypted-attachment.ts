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

export interface AttachmentSource {
  id: Id<"vault_item_files">;
  iv: string;
  name: string;
}

const PARALLEL = 2;
const LOADING: AttachmentState = { status: "loading" };

export function useDecryptedAttachments(
  files: readonly AttachmentSource[],
  key: CryptoKey | undefined,
) {
  const convex = useConvex();
  const network = useNetworkState();
  const online = useRef(network.isInternetReachable);
  const opened = useRef(new Map<string, File>());
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [results, setResults] = useState<Record<string, AttachmentState>>({});

  useEffect(() => {
    online.current = network.isInternetReachable;
  }, [network.isInternetReachable]);

  useEffect(() => {
    const all = opened.current;
    return () => {
      for (const file of all.values()) if (file.exists) file.delete();
      all.clear();
    };
  }, []);

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
        const url = await convex.query(api.vault_items.getItemFileUrl, {
          fileId: request.id,
        });
        if (!url) throw new FileProblemError("missing");
        const plain = await downloadDecrypted(
          url,
          request.iv,
          key!,
          request.name,
        );
        if (!alive) {
          plain.delete();
          return;
        }
        const previous = opened.current.get(request.id);
        if (previous?.exists) previous.delete();
        opened.current.set(request.id, plain);
        state = { status: "ready", uri: plain.uri };
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
  }, [convex, key, wanted]);

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
