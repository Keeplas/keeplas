// Shared aggregation helpers for the read-only admin (keeplas-admin) queries.
// All admin queries scan whole tables — acceptable at the current product
// volume. If a table grows large, replace the scan with an incremental counter
// (see the TODOs at each call site) rather than paginating here.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Floor a timestamp (ms) to the start of its UTC day. */
export function startOfDayUTC(ts: number): number {
  return ts - (ts % DAY_MS);
}

/**
 * Count items grouped by a string key. `null`/`undefined` keys fall into the
 * `fallback` bucket (default "unknown").
 */
export function countBy<T>(
  items: T[],
  key: (item: T) => string | null | undefined,
  fallback = "unknown",
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item) ?? fallback;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** Count how many items satisfy a predicate. */
export function countWhere<T>(items: T[], pred: (item: T) => boolean): number {
  let n = 0;
  for (const item of items) if (pred(item)) n++;
  return n;
}

/**
 * Bucket items into a per-UTC-day summed series, sorted ascending by day.
 * `value` defaults to 1 (a plain count per day).
 */
export function seriesByDay<T>(
  items: T[],
  ts: (item: T) => number,
  value: (item: T) => number = () => 1,
): { day: number; value: number }[] {
  const map = new Map<number, number>();
  for (const item of items) {
    const day = startOfDayUTC(ts(item));
    map.set(day, (map.get(day) ?? 0) + value(item));
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, v]) => ({ day, value: v }));
}
