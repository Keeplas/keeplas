import { useEffect, useMemo, useState } from "react";

import { decryptText } from "@/crypto/envelope";
import { parseFileMeta, type FileMeta } from "@/crypto/item-meta";
import { useOutbox } from "@/features/outbox/outbox-provider";
import type { OutboxEntry } from "@/features/outbox/outbox";

export interface PendingAttachment {
  entry: OutboxEntry;
  meta: FileMeta | null;
  index: number;
  ratio: number;
}

export function usePendingAttachments(
  itemId: string,
  key: CryptoKey | undefined,
): PendingAttachment[] {
  const { entries, progress } = useOutbox();
  const mine = useMemo(
    () => entries.filter((entry) => entry.attachTo === itemId),
    [entries, itemId],
  );
  const [metas, setMetas] = useState<Record<string, (FileMeta | null)[]>>({});

  useEffect(() => {
    if (!key || mine.length === 0) return;
    let alive = true;
    void Promise.all(
      mine.map(async (entry) => [
        entry.id,
        await Promise.all(
          entry.files.map((file) =>
            decryptText(file.encryptedMeta, key)
              .then(parseFileMeta)
              .catch(() => null),
          ),
        ),
      ]),
    ).then((pairs) => {
      if (alive) setMetas(Object.fromEntries(pairs));
    });
    return () => {
      alive = false;
    };
  }, [key, mine]);

  return mine.flatMap((entry) => {
    const sent = progress[entry.id];
    const ratio = sent?.total ? Math.min(1, sent.sent / sent.total) : 0;
    return entry.files.map((_, index) => ({
      entry,
      meta: metas[entry.id]?.[index] ?? null,
      index,
      ratio,
    }));
  });
}
