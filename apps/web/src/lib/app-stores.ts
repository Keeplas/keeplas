import { mobilePlatform } from "./user-agent";

export interface StoreUrls {
  appStore?: string;
  playStore?: string;
}

/** Store listings of the Keeplas app (inlined at build time, may be unset). */
export const STORE_URLS: StoreUrls = {
  appStore: process.env.NEXT_PUBLIC_APP_STORE_URL || undefined,
  playStore: process.env.NEXT_PUBLIC_PLAY_STORE_URL || undefined,
};

/**
 * Where `/download` sends this visitor: the store of their phone, or null
 * (computer, unknown phone, store URL not configured) to show D-01 instead.
 */
export function storeUrlForUserAgent(
  ua: string,
  stores: StoreUrls,
): string | null {
  const platform = mobilePlatform(ua);
  if (platform === "ios") return stores.appStore ?? null;
  if (platform === "android") return stores.playStore ?? null;
  return null;
}
