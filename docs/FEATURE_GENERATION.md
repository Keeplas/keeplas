# Feature Generation Guide

How to scaffold a new dashboard feature in Keeplas. Use this as a template prompt
for AI assistants and as a checklist for human authors. Match the existing
conventions exactly — drift is what makes the codebase hard to navigate.

## Prerequisites

- Next.js 16 App Router, React 19, Convex 1.35+, pnpm 10.8+, Tailwind v4.
- Backend functions live under `packages/convex/` and are imported via
  `@keeplas/backend/_generated/api` from the web app.
- All UI primitives come from `@keeplas/ui` (shadcn/Radix). Never write custom
  interactive components — see `CLAUDE.md`.
- Storage access **only** through `packages/convex/lib/storage.ts`. Do not
  import `Id<"_storage">` or call `ctx.storage.*` outside that file.

## Folder layout

Pages live directly under a route group. Co-locate feature components next to
the page that uses them — no separate `/features/` directory.

```
apps/web/src/app/(dashboard)/<feature-name>/
├── page.tsx                  # Top-level route, server or client as needed
├── <feature>-card.tsx        # Co-located components
├── <feature>-dialog.tsx
├── use-<hook>.ts             # Co-located hooks specific to this feature
└── (sub-route)/page.tsx      # Optional nested routes
```

Reusable hooks/utilities go in `apps/web/src/lib/`. Reusable cross-feature
components go in `apps/web/src/components/`. Default to co-location; promote
only when ≥2 features need it (DRY rule from `CLAUDE.md`).

## Backend (`packages/convex/`)

Add Convex queries/mutations in a single file per domain (e.g.
`packages/convex/trusted_contacts.ts`). After editing anything under
`packages/convex/`, run `npx convex dev` to regenerate types.

```ts
// packages/convex/<domain>.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { auditedMutation } from "./audit";

export const list<Things> = query({
  args: {},
  handler: async (ctx) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db
      .query("<thingsTable>")
      .withIndex("by_user", (q) => q.eq("userId", userId.subject))
      .collect();
  },
});

// Mutations that must produce a tamper-evident log entry use auditedMutation.
// The web app calls them via useAuditedMutation, which injects the sealed
// audit context (IP + country + HMAC) from the session cookie.
export const create<Thing> = auditedMutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    // ...
  },
});
```

Validators live in `packages/convex/validators.ts`. Storage-touching code
lives only in `packages/convex/lib/storage.ts` — wrap it from your domain
file rather than calling `ctx.storage.*` directly.

## Page (`apps/web/src/app/(dashboard)/<feature>/page.tsx`)

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { Loader } from "@keeplas/ui";
import { useAuditedMutation } from "@/lib/use-audited-mutation";
import { toUserMessage, safeLog } from "@/lib/errors";

export default function <Feature>Page() {
  const items = useQuery(api.<domain>.list<Things>);
  const createItem = useAuditedMutation(api.<domain>.create<Thing>);

  if (items === undefined) {
    return <Loader size="md" />;
  }

  async function onCreate(name: string) {
    try {
      await createItem({ name });
    } catch (error) {
      safeLog("<feature>:create", error);
      // Show toUserMessage(error) via your toast / inline error component.
    }
  }

  return (
    <div className="max-w-screen-2xl mx-auto">
      <header className="mb-8 max-w-3xl">
        <h1 className="text-headline-lg text-primary mb-4"><Feature></h1>
        <p className="text-body-lg text-on-surface-variant">
          One-line description of what this feature does for the user.
        </p>
      </header>
      {/* feature body */}
    </div>
  );
}
```

### Conventions to follow

- **Loading**: render `<Loader size="md" />` while `useQuery` returns
  `undefined`. The dashboard layout already handles auth/onboarding/TOTP gates.
- **Mutations**: prefer `useAuditedMutation` for anything that creates,
  modifies, or destroys user data. Use plain `useMutation` only for
  non-audit-relevant calls (e.g. UI preferences).
- **Errors**: wrap mutation calls in try/catch, route through
  `safeLog` + `toUserMessage` from `@/lib/errors`. Never display a raw
  `error.message` from a Convex call to the user.
- **Crypto**: read the master key from `useMasterKey()` (auto-cleared on
  sign-out). For shared workflows, see `use-vault-crypto.ts`,
  `use-recipient-crypto.ts`, `use-distribute-shards.ts`.

## Styling tokens

Use semantic Tailwind tokens defined in `globals.css`. Prefer them over raw
colors:

| Surface                                           | Foreground                                   |
| ------------------------------------------------- | -------------------------------------------- |
| `bg-surface`, `bg-surface-container[-low\|-high]` | `text-on-surface`, `text-on-surface-variant` |
| `bg-primary-container`                            | `text-on-primary-container`                  |
| `bg-secondary`, `vault-gradient`                  | `text-on-secondary`, `text-on-primary`       |
| `bg-error-container`                              | `text-error`, `text-on-error-container`      |

Typography scale: `text-headline-lg`, `text-headline-md`, `text-headline-sm`,
`text-body-lg`, `text-body-md`, `text-label-md`. Fonts: Manrope (display) +
Inter (body), already wired via `next/font` in `app/layout.tsx`.

## Sidebar integration

If the new feature is a top-level dashboard page, add a navigation entry to
`apps/web/src/components/sidebar.tsx`. Match the existing icon convention
(`Icon path={ICON_PATHS.<name>}`) and the active-route highlight pattern
already there.

## Pre-submit checklist

Run the four-question check from `CLAUDE.md` before opening a PR:

1. If I delete this line / file / prop, what breaks? — if nothing, delete it.
2. Is this abstraction used in ≥2 places today? — if no, inline it.
3. Does this duplicate something that already exists? — grep first, extract second.
4. Did I add anything the task didn't ask for? — remove it.

Plus the Keeplas-specific gates:

- Vault items never set `accessLevel: "public"`.
- Storage IDs never escape `packages/convex/lib/storage.ts`.
- No master key, recovery phrase, or shard ever leaves the client unencrypted.
- `pnpm typecheck && pnpm lint` are green.
- `npx convex dev` re-run if any `packages/convex/**` file changed.
