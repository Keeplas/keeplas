# Infobip inbound WhatsApp webhook

When a user **replies** to the Life Check WhatsApp message, that reply is the inbound leg of the
dead-man's switch: it proves they are alive, validates the in-flight check-in cycle, resets the
inactivity counter, and cancels any pending escalation to trusted contacts — all without the user
opening the app.

The receiving code already exists in the repo. **What does _not_ ship in the repo is the Infobip-side
configuration that forwards inbound messages to it.** This runbook covers that one-time setup.

Code references:

- `packages/convex/http.ts` — `POST /webhooks/infobip/whatsapp` route (auth + payload parsing).
- `packages/convex/life_check.ts` — `validateFromWhatsApp` → `confirmAlive(..., "whatsapp")`.
- `packages/convex/dispatch.ts` — outbound template `keeplas_life_check_en` (the message users reply to).

## TL;DR

1. Pick a strong shared secret: `openssl rand -base64 32`.
2. Set it on Convex as `INFOBIP_INBOUND_SECRET` (dev **and** prod deployments).
3. In Infobip, forward your sender's **inbound messages** to the Convex webhook URL below. Put the
   secret in the notification profile's **Advanced settings → Headers** as `x-keeplas-webhook-secret`
   — and leave **Security settings empty** (see why below).
4. Verify with `npx convex run testing:confirmWhatsApp`, a raw `curl`, then a real reply.

## Webhook URL

Convex serves HTTP actions on the **`.convex.site`** domain (note: **not** `.convex.cloud`, which is
the data/API domain). The path is `/webhooks/infobip/whatsapp`:

| Deployment                  | URL                                                                |
| --------------------------- | ------------------------------------------------------------------ |
| Prod (`energetic-pony-179`) | `https://energetic-pony-179.convex.site/webhooks/infobip/whatsapp` |
| Dev (`handsome-panda-166`)  | `https://handsome-panda-166.convex.site/webhooks/infobip/whatsapp` |

Method: `POST` · Body format: `JSON`.

Each contributor's personal dev deployment has its own `<name>.convex.site` host — use yours. Find it
with `npx convex env get CONVEX_SITE_URL` or by swapping `.convex.cloud` → `.convex.site` on your
`NEXT_PUBLIC_CONVEX_URL`.

## The shared secret

The webhook is unauthenticated by user session (Infobip has no Keeplas login), so it is gated by a
shared secret carried in the `x-keeplas-webhook-secret` header. The handler rejects any request whose
header does not match `INFOBIP_INBOUND_SECRET` with `401`.

The secret must be **identical** on both sides:

- **Convex** — set `INFOBIP_INBOUND_SECRET` on each deployment:

  ```bash
  npx convex env set INFOBIP_INBOUND_SECRET "<your-secret>"            # current dev deployment
  npx convex env set INFOBIP_INBOUND_SECRET "<your-secret>" --prod     # production
  ```

  (Or include it in your `.env` and run `pnpm sync:convex-env`. The var is already documented in
  `.env.example` under the "WhatsApp via Infobip" block.)

  Verify it actually landed with `npx convex env list | grep '^INFOBIP_INBOUND_SECRET='` — **not**
  `npx convex env get …`, which exits `0` (success) even when the variable is absent and will fool a
  presence check.

- **Infobip** — add the HTTP header `x-keeplas-webhook-secret` = the same value to the forwarding
  configuration (see below).

## Configure forwarding in Infobip

In **CPaaS X → Subscriptions**, a subscription decides _which events_ fire and _where_ they go (the
**notification profile**). Set both.

1. **Subscription** — on your WhatsApp sender / application:
   - **Event**: `Inbound message` **only**. Do **not** add delivery reports or "seen" / read-receipt
     events (see note below).
2. **Notification profile** — this is where the webhook and headers live:
   - **Webhook URL**: the Convex URL for the target environment (table above).
   - **Security settings**: leave **empty / None**. Do **not** pick Basic / HMAC / OAuth — the handler
     does not verify a signature, only that the custom header equals the secret. (HMAC would make
     Infobip send a _signature_ header instead, which the handler ignores → it would still `401`.)
   - **Advanced settings → Headers** (the **ADD HEADER** control): add one key-value pair
     - key: `x-keeplas-webhook-secret`
     - value: the **exact** value of `INFOBIP_INBOUND_SECRET` on Convex.
3. Save and confirm the subscription is **active** for the correct sender.

> **Do not forward delivery reports or read receipts.** A read receipt is too weak to mean "alive" for
> a dead-man's switch, and the handler ignores them anyway — forwarding them is just noise. Only
> inbound messages (free-text reply or Quick-reply button tap) count as liveness.

### Common pitfalls (all surface as `401`)

- **Secret put in Security settings (HMAC).** The HMAC `Secret key` produces a _signature header_, not
  the `x-keeplas-webhook-secret` header the handler checks. The secret goes **only** in
  Advanced settings → Headers.
- **`INFOBIP_INBOUND_SECRET` not set on Convex.** The handler is `if (!secret || header !== secret)` —
  with no secret configured it returns `401` for **every** request, even one carrying the right header.
  Confirm presence with `npx convex env list | grep` (see "The shared secret" above).
- **Values differ.** The Convex value and the Infobip header value must match byte-for-byte.

> _Last-resort fallback:_ if your Infobip plan genuinely cannot send a custom header, carry the secret
> in the URL query string and adapt `packages/convex/http.ts` to read it from the query param. This is
> a code change and leaks the secret into logs more easily — prefer the header.

## Inbound payload format

Infobip delivers inbound WhatsApp messages as a JSON body with a `results` array; the handler only
reads `from` (the sender's number) from each entry:

```json
{
  "results": [
    { "from": "33612345678", "message": { "type": "TEXT", "text": "I'm well" } }
  ],
  "messageCount": 1
}
```

Infobip sends `from` as bare digits (no leading `+`); the handler normalizes it to E.164 (`+33…`)
before looking the user up via the `users` `by_phone` index. **The user's stored `phoneNumber` must be
in E.164 format** for the match to succeed — otherwise the reply is a silent no-op (`200`, unmatched).

## Verify

### 1. Without Infobip — simulate the inbound leg

`testing:confirmWhatsApp` drives the real `validateFromWhatsApp` (the webhook's entry point) using the
user's verified phone number, so it exercises everything except the Infobip transport:

```bash
npx convex run testing:confirmWhatsApp '{"email":"user@example.com"}'
```

Expect `matched: true`. Then confirm the in-flight `life_check_cycles` row flipped to
`status: "validated"` / `validatedBy: "whatsapp"`, and that the `life_check_configs` `nextCheckAt` was
pushed out.

### 2. Raw HTTP — test auth end of the wire

First make sure the secret is actually set on the target deployment:

```bash
npx convex env list | grep '^INFOBIP_INBOUND_SECRET='   # empty output = NOT set → fix before testing
```

Then probe the endpoint. An **empty** `results` array exercises auth only (no user lookup, no side
effect), so it is safe to run against any deployment:

```bash
# 200 — secret matches
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://handsome-panda-166.convex.site/webhooks/infobip/whatsapp" \
  -H "x-keeplas-webhook-secret: <your-secret>" \
  -H "content-type: application/json" -d '{"results":[]}'

# 401 — missing or wrong secret (also what you get if the var is unset on Convex)
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://handsome-panda-166.convex.site/webhooks/infobip/whatsapp" \
  -H "content-type: application/json" -d '{"results":[]}'
```

To exercise the full path including the user lookup, add a real sender (E.164 **without** the leading
`+`): `-d '{"results":[{"from":"33612345678"}]}'`. Note this actually resets that user's liveness.

### 3. Real end-to-end

Set a user's Life Check `frequency` to `test` to collapse the timers, trigger a cycle, receive the
WhatsApp message, **reply** (text or tap "I'm well"), and confirm the cycle is validated and the
escalation cancelled.
