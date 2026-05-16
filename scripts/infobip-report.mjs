#!/usr/bin/env node
// Fetches the FINAL WhatsApp delivery status from Infobip's logs API. A 200 /
// PENDING_ENROUTE on send only means "accepted into the pipeline" — the real
// outcome (DELIVERED / UNDELIVERABLE / REJECTED + reason) lands asynchronously
// and is intentionally NOT consumed by the inbound webhook (packages/convex/
// http.ts). Use this to confirm WHY a message did not arrive.
//
// Uses Infobip's unified Messages API reports endpoint
// (GET /messages-api/1/reports) — the channel-specific /whatsapp/1/logs and
// /whatsapp/1/reports paths do not exist on this account (404). Note: reports
// are consume-once — each report is returned only on the first pull.
//
// Run via:
//   node --env-file-if-exists=.env --env-file-if-exists=.env.local \
//        --env-file-if-exists=.env.convex.local scripts/infobip-report.mjs [messageId]
//
// With a messageId  → status for that one message.
// Without an argument → the 10 most recent sends.

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { RED, YELLOW, GREEN, RESET } from "./_env-keys.mjs";

const envLocalPath = resolve(process.cwd(), ".env.local");
const envPath = resolve(process.cwd(), ".env");
if (!existsSync(envLocalPath) && !existsSync(envPath)) {
  console.error(
    `\n${RED}Missing .env.local at ${envLocalPath}${RESET}\n\n` +
      `Run \`cp .env.example .env.local\` first, then fill the Infobip keys.\n`,
  );
  process.exit(1);
}

const baseUrl = process.env.INFOBIP_BASE_URL;
const apiKey = process.env.INFOBIP_API_KEY;
if (!baseUrl || !apiKey) {
  console.error(
    `\n${RED}INFOBIP_BASE_URL and INFOBIP_API_KEY must be set${RESET}\n\n` +
      `Fill them in \`.env.local\` (or \`.env.convex.local\`) — see .env.example.\n`,
  );
  process.exit(1);
}

// Same normalization as packages/convex/dispatch.ts: Infobip's dashboard hands
// out the base URL as a bare host, but fetch() needs an absolute URL.
const root = baseUrl.replace(/\/$/, "");
const origin = /^https?:\/\//i.test(root) ? root : `https://${root}`;

const messageId = process.argv[2];
const query = messageId
  ? `messageId=${encodeURIComponent(messageId)}`
  : `limit=10`;

const res = await fetch(`${origin}/messages-api/1/reports?${query}`, {
  headers: {
    Authorization: `App ${apiKey}`,
    Accept: "application/json",
  },
});

if (res.status === 403) {
  console.error(
    `\n${RED}Infobip 403 — this API key cannot read delivery reports.${RESET}\n\n` +
      `The key can send (POST /whatsapp/1/message/template works) but lacks the\n` +
      `Messages API reports scope. To diagnose delivery, either:\n` +
      `  - grant this key the reports permission in the Infobip portal\n` +
      `    (Account → API keys), or\n` +
      `  - read the final status directly in the portal: Analyze → Logs.\n`,
  );
  process.exit(1);
}

if (!res.ok) {
  const text = await res.text();
  console.error(
    `\n${RED}Infobip reports API ${res.status}${RESET}: ${text.slice(0, 200)}\n`,
  );
  process.exit(1);
}

const { results = [] } = await res.json();

if (results.length === 0) {
  console.log(
    `\n${YELLOW}No WhatsApp logs found${RESET}` +
      (messageId ? ` for messageId ${messageId}` : ` (last 10)`) +
      `.\nInfobip retains logs for a limited window — send a test message and retry.\n`,
  );
  process.exit(0);
}

const NEGATIVE = new Set(["UNDELIVERABLE", "REJECTED"]);
let failed = false;

for (const r of results) {
  const status = r.status ?? {};
  const group = status.groupName ?? "?";
  const isNegative = NEGATIVE.has(group);
  const color = isNegative ? RED : group === "DELIVERED" ? GREEN : YELLOW;
  if (isNegative || r.error) failed = true;

  console.log(
    `\n${color}● ${group} / ${status.name ?? "?"}${RESET}` +
      `\n  to:        ${r.to ?? "?"}` +
      `\n  sentAt:    ${r.sentAt ?? "?"}` +
      `\n  doneAt:    ${r.doneAt ?? "—"}` +
      `\n  messageId: ${r.messageId ?? "?"}` +
      `\n  status:    ${status.description ?? "—"}`,
  );
  if (r.error) {
    console.log(
      `  ${RED}error:     ${r.error.name ?? "?"} — ${r.error.description ?? "?"}` +
        ` (permanent: ${r.error.permanent ?? "?"})${RESET}`,
    );
  }
}

console.log("");
process.exit(failed ? 1 : 0);
