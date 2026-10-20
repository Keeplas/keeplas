export const TAB_NAMES = ["home", "search", "people", "settings"] as const;

export type TabName = (typeof TAB_NAMES)[number];

const FULL_SCREEN = [
  "/capture",
  "/scan",
  "/new-device",
  "/not-me",
  "/secured",
  "/link-blocked",
  "/recovery-approval",
  "/rotate-keys",
];

export function showsTabBar(pathname: string): boolean {
  return !FULL_SCREEN.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}

export const isTabName = (name: string): name is TabName =>
  (TAB_NAMES as readonly string[]).includes(name);
