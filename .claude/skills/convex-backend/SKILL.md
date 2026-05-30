---
name: convex-backend
description: Keeplas Convex backend conventions — how to write a correct query/mutation. Auth guards (requireAuth/optionalAuth + TOTP/login-OTP variants), the mandatory auditedMutation wrapper for any state change, withIndex rules, shared validators, helpers, and the test harness. Use whenever you create or edit anything under packages/convex/ (queries, mutations, schema, helpers, tests).
---

# Keeplas Convex Backend Conventions

How to write a backend function that passes review on the first try. Grounded in the real code — every name below exists in `packages/convex/`.

## Before you start

After editing **anything** under `packages/convex/`, run `npx convex dev` to regenerate `_generated/` types and sync the deployment. Skipping this leaves stale types and broken `api.*` references.

## Auth guards (`helpers.ts`)

Every query and mutation starts by resolving identity. Never read user data without a guard.

| Function                          | Returns         | Use                                                            |
| --------------------------------- | --------------- | ------------------------------------------------------------- |
| `requireAuth(ctx)`                | `userId`, throws | **Mutations** — must be authenticated                        |
| `optionalAuth(ctx)`               | `userId \| null` | **Queries** that can render empty when logged out            |
| `requireAuthWithTotp(ctx)`        | `userId`, throws `"TOTP_REQUIRED"` | Sensitive reads when TOTP is enrolled but not cleared |
| `requireAuthWithLoginOtp(ctx)`    | `userId`, throws `"LOGIN_OTP_REQUIRED"` | Always-on login-OTP step-up (password accounts only) |
| `hasPasswordAccount(ctx, userId)` | `boolean`       | Branch on whether the OTP gate applies                        |

- **Query** → `optionalAuth` then early-return `[]` / `null` when null.
- **Mutation** → `requireAuth` (or a step-up variant for sensitive operations). The `*_REQUIRED` throws are caught by the client to redirect to the challenge page — don't swallow them.

## `auditedMutation` — mandatory for any state change

**Every mutation that mutates user-owned state MUST use `auditedMutation`** (`audit.ts`), not bare `mutation`. It verifies the HMAC-sealed `_audit` envelope, resolves the actor, runs your handler, then appends a chained, tamper-evident audit log entry. That chain is the legal-admissibility story — a missing entry is a hole in it.

```ts
export const updateProfile = auditedMutation({
  action: "user.profile.updated", // namespace.resource.verb
  resourceType: "user",
  args: { name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await ctx.db.patch(userId, { updatedAt: Date.now(), name: args.name });
  },
});
```

Optional resolvers:

- `getResourceId(args, result, userId)` — return the affected entity's ID for **per-resource** mutations (vault items, contacts…). Defaults to the acting user's ID (right for profile-style mutations).
- `getMetadata(args, result)` — structured object persisted as JSON on the entry.
- `resolveActor(ctx, args)` — when the action targets **another** user's audit chain (e.g. a trusted contact acting on the inviter's vault). Defaults to the authenticated user as both actor and chain owner.

**Never** add `_audit` to `args` or pass it yourself — the wrapper injects and verifies it.

### When bare `mutation` is OK

Only for operations with **no persistent user state change** — e.g. `generateAvatarUploadUrl` (users.ts), which just issues a signed upload URL. Everything else → `auditedMutation`.

## Indexes are mandatory (`schema.ts`)

Never `.filter()` a large table without first narrowing by an index.

```ts
await ctx.db
  .query("vault_items")
  .withIndex("by_user", (q) => q.eq("userId", userId)) // index FIRST
  .filter((q) => q.neq(q.field("status"), "archived")) // refine after
  .collect();
```

Index naming: `by_<field>` (`by_user`, `by_session`, `by_phone`) or `by_<f1>_<f2>` (`by_user_expires`). Add the index to `defineTable(...).index(...)` in `schema.ts` before querying it.

## Shared validators (`validators.ts`)

Reuse `categoryValidator`, `accessLevelValidator` — don't redeclare an enum inline (3rd occurrence → extract here). Note `accessLevelValidator` still accepts legacy `"public"`/`"emergency_only"` only to migrate old rows; **never set `accessLevel: "public"`** on a vault item (breaks the ZK model).

## Reuse helpers (`helpers.ts`)

Before duplicating index/filter logic, use the existing helpers: `getUserVault`, `getActiveItems`, `requireItemOwnership`, `resolveItemRecipients`. Extract a new one once ≥2 call sites share the shape (DRY/KISS).

## Client side

Call an audited mutation with `useAuditedMutation(api.x.y)` (`apps/web/src/lib/use-audited-mutation.ts`), **never** bare `useMutation` — otherwise the `_audit` envelope is missing and the call throws. Gate the UI on `useRequestContext() !== null` before mounting one.

## Tests (`__tests__/test.helpers.ts`, vitest)

```ts
const t = makeT();
const userId = await seedUser(t);
await asUser(t, userId).mutation(api.users.updateProfile, {
  name: "Ada",
  _audit: await signedAudit(), // required for audited mutations
});
// assert via t.run((ctx) => ctx.db.get(userId))
```

`makeT()` boots a `convex-test` instance, `seedUser` inserts a bare user, `asUser` sets the identity, `signedAudit()` builds a valid HMAC envelope. `KEEPLAS_CTX_SECRET` is set by the helper.

## Don'ts

- No bare `mutation` for a state change → `auditedMutation`.
- No `.filter()` without a leading `.withIndex()` on a large table.
- No inline enum that duplicates `validators.ts`.
- No `useMutation` on an audited mutation → use `useAuditedMutation`.
- No forgetting `npx convex dev` after editing `packages/convex/`.
- No `ctx.storage.*` outside `lib/storage.ts`.
- No `accessLevel: "public"`.

## Reference Files

- Auth guards & helpers: `packages/convex/helpers.ts`
- Audit wrapper: `packages/convex/audit.ts`
- Shared validators: `packages/convex/validators.ts`
- Schema & indexes: `packages/convex/schema.ts`
- Test harness: `packages/convex/__tests__/test.helpers.ts`
- Client hook: `apps/web/src/lib/use-audited-mutation.ts`
