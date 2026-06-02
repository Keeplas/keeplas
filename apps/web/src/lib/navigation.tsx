/**
 * Next.js navigation compatibility shim, implemented on top of TanStack Router.
 *
 * The app was migrated from Next.js to TanStack Start. Rather than rewrite every
 * call site, this module re-exposes the small slice of the `next/link` +
 * `next/navigation` API the app actually used (`Link`, `useRouter` with
 * push/replace/back, `usePathname`, `useSearchParams`, `useParams`) mapped onto
 * TanStack Router primitives. TanStack's link/navigate generics are intentionally
 * loosened here (this is the single boundary where we accept arbitrary runtime
 * paths) so the rest of the app keeps its existing, simpler call sites.
 */
import {
  Link as RouterLink,
  useNavigate,
  useParams as useRouterParams,
  useRouter as useTanstackRouter,
  useRouterState,
} from "@tanstack/react-router";
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const AnyLink = RouterLink as any;

/** Split a Next-style href into a TanStack `{ to, search }` pair. */
function splitTo(href: string): {
  to: string;
  search?: Record<string, string>;
} {
  const [pathname, query] = href.split("?");
  if (!query) return { to: pathname };
  const search: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(query)) search[k] = v;
  return { to: pathname, search };
}

type LinkProps = {
  href: string;
  children?: ReactNode;
  replace?: boolean;
  // Next-only props we accept and ignore.
  prefetch?: boolean;
  scroll?: boolean;
  passHref?: boolean;
  legacyBehavior?: boolean;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

/** Drop-in replacement for `next/link`'s default export. */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  {
    href,
    prefetch: _prefetch,
    scroll: _scroll,
    passHref: _passHref,
    legacyBehavior: _legacyBehavior,
    replace,
    ...rest
  },
  ref,
) {
  // External / hash / mailto / tel links: render a plain anchor.
  if (!href || !href.startsWith("/")) {
    return <a ref={ref} href={href} {...rest} />;
  }
  const { to, search } = splitTo(href);
  return (
    <AnyLink
      ref={ref}
      to={to}
      {...(search ? { search } : {})}
      replace={replace}
      {...rest}
    />
  );
});

/** Drop-in replacement for `next/navigation`'s `useRouter`. */
export function useRouter() {
  const navigate = useNavigate();
  const router = useTanstackRouter();
  const go = (href: string, replace?: boolean) => {
    const { to, search } = splitTo(href);
    navigate({ to, search, replace } as any);
  };
  return {
    push: (href: string) => go(href),
    replace: (href: string) => go(href, true),
    back: () => router.history.back(),
    forward: () => router.history.forward(),
    refresh: () => router.invalidate(),
    prefetch: () => {},
  };
}

/** Drop-in replacement for `next/navigation`'s `usePathname`. */
export function usePathname(): string {
  return useRouterState({ select: (s) => s.location.pathname });
}

/** Drop-in replacement for `next/navigation`'s `useSearchParams`. */
export function useSearchParams(): URLSearchParams {
  const search = useRouterState({ select: (s) => s.location.search }) as Record<
    string,
    unknown
  >;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search ?? {})) {
    if (value != null) params.set(key, String(value));
  }
  return params;
}

/** Drop-in replacement for `next/navigation`'s `useParams`. */
export function useParams<
  T extends Record<string, string | string[]> = Record<string, string>,
>(): T {
  return (useRouterParams as any)({ strict: false }) as T;
}
