import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import { makeT } from "./test.helpers";

// Device and recovery alerts on WhatsApp: the template name and placeholders
// must match the templates approved in Infobip, or Meta rejects the send.

type Sent = { templateName: string; placeholders: string[] };

function captureWhatsApp(): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/whatsapp/1/message/template")) {
        const { content } = JSON.parse(init.body as string).messages[0];
        sent.push({
          templateName: content.templateName,
          placeholders: content.templateData.body.placeholders,
        });
      }
      return new Response(JSON.stringify({}));
    }),
  );
  return sent;
}

describe("WhatsApp alerts", () => {
  beforeEach(() => {
    process.env.INFOBIP_BASE_URL = "infobip.test";
    process.env.INFOBIP_API_KEY = "key";
    process.env.INFOBIP_WHATSAPP_SENDER = "33100000000";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the device label to keeplas_new_device", async () => {
    const sent = captureWhatsApp();
    await makeT().action(internal.dispatch.notifyNewDevice, {
      phoneNumber: "+33611111111",
      deviceLabel: "Chrome on macOS",
      language: "fr",
    });
    expect(sent).toEqual([
      {
        templateName: "keeplas_new_device_fr",
        placeholders: ["Chrome on macOS"],
      },
    ]);
  });

  it("sends keeplas_recovery_started without a placeholder", async () => {
    const sent = captureWhatsApp();
    const t = makeT();
    for (const ownerName of ["Ada", undefined]) {
      await t.action(internal.dispatch.notifyRecoveryStarted, {
        phoneNumber: "+33611111111",
        ownerName,
      });
    }
    expect(sent).toEqual([
      { templateName: "keeplas_recovery_started_en", placeholders: [] },
      { templateName: "keeplas_recovery_started_en", placeholders: [] },
    ]);
  });

  it("sends the owner name to keeplas_recovery_contact", async () => {
    const sent = captureWhatsApp();
    await makeT().action(internal.dispatch.notifyRecoveryContact, {
      phoneNumber: "+33611111111",
      owner: { name: "Ada" },
    });
    expect(sent).toEqual([
      { templateName: "keeplas_recovery_contact_en", placeholders: ["Ada"] },
    ]);
  });
});
