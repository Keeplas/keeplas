import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import { makeT } from "./test.helpers";

// What people read in alerts and codes: a lock screen shows no one's email,
// phone or situation (App Review 4.5.4), every channel speaks the recipient's
// language, and a code says what it is for.

const EXPO_SEND = "https://exp.host/--/api/v2/push/send";
const RESEND = "https://api.resend.com/emails";

type Push = { title: string; body: string };
type Email = { subject: string; html: string; text: string };

function capture() {
  const push: Push[] = [];
  const email: Email[] = [];
  const whatsapp: string[][] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (url === EXPO_SEND) {
        push.push(...body);
        return Response.json({ data: body.map(() => ({ status: "ok" })) });
      }
      if (url === RESEND) email.push(body);
      if (url.endsWith("/whatsapp/1/message/template")) {
        whatsapp.push(body.messages[0].content.templateData.body.placeholders);
      }
      return Response.json({});
    }),
  );
  return { push, email, whatsapp };
}

const ENV = {
  RESEND_API_KEY: "re_test",
  RESEND_FROM_EMAIL: "Keeplas <hello@keeplas.test>",
  APP_URL: "https://app.keeplas.test",
  INFOBIP_BASE_URL: "infobip.test",
  INFOBIP_API_KEY: "key",
  INFOBIP_WHATSAPP_SENDER: "33100000000",
};

const OWNER = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  phoneNumber: "+33611111111",
};
const CONTACT = {
  email: "bob@example.com",
  phoneNumber: "+33622222222",
  contactName: "Bob",
  pushTokens: ["ExponentPushToken[bob]"],
};
const OWNER_CHANNELS = {
  email: OWNER.email,
  phoneNumber: OWNER.phoneNumber,
  pushTokens: ["ExponentPushToken[ada]"],
};
const CONTACT_ALERTS = [
  internal.dispatch.notifyRecoveryContact,
  internal.dispatch.notifyConfirmationRequest,
  internal.dispatch.notifyRelease,
];
const PHONE_NUMBER = /\d[\d\s.-]{6,}\d/;

beforeEach(() => {
  Object.assign(process.env, ENV);
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(ENV)) delete process.env[key];
});

describe("alerts to trusted contacts", () => {
  it("keep the owner's email, phone and situation off the lock screen", async () => {
    const sent = capture();
    const t = makeT();
    for (const language of ["en", "fr"]) {
      for (const alert of CONTACT_ALERTS) {
        await t.action(alert, { ...CONTACT, owner: OWNER, language });
      }
    }
    expect(sent.push).toHaveLength(6);
    for (const { title, body } of sent.push) {
      const text = `${title} ${body}`;
      expect(text).not.toContain("@");
      expect(text).not.toMatch(PHONE_NUMBER);
      expect(text).not.toContain("Lovelace");
      expect(text).not.toMatch(/stopped responding|ne répond plus|unavailable/);
      expect(text).toContain("Ada");
    }
    // Email and WhatsApp still identify the owner in full.
    for (const { text } of sent.email) expect(text).toContain(OWNER.email);
    for (const [placeholder] of sent.whatsapp) {
      expect(placeholder).toContain(OWNER.phoneNumber);
    }
  });

  it("stay neutral on the lock screen for an owner without a name", async () => {
    const sent = capture();
    const t = makeT();
    for (const alert of CONTACT_ALERTS) {
      await t.action(alert, { ...CONTACT, owner: { email: OWNER.email } });
    }
    for (const { body } of sent.push) expect(body).not.toContain("@");
  });

  it("say the owner then gets a final 72-hour window", async () => {
    const sent = capture();
    await makeT().action(internal.dispatch.notifyConfirmationRequest, {
      ...CONTACT,
      owner: OWNER,
    });
    expect(sent.email[0].text).toContain(
      "confirm, they get a final 72-hour window",
    );
  });
});

describe("French alerts", () => {
  const ENGLISH =
    /A Keeplas user|Someone|\bthere\b|\bHi\b|A phone|restored|new number|A new device/;

  it("have no English fallback or device name in them", async () => {
    const sent = capture();
    const t = makeT();
    for (const alert of CONTACT_ALERTS) {
      await t.action(alert, { ...CONTACT, owner: {}, language: "fr" });
    }
    for (const deviceKind of [
      "icloud_restore",
      "google_restore",
      "new_number",
    ] as const) {
      await t.action(internal.dispatch.notifyNewDevice, {
        ...OWNER_CHANNELS,
        deviceKind,
        language: "fr",
      });
    }
    await t.action(internal.dispatch.notifyGraceCancel, {
      ...OWNER_CHANNELS,
      language: "fr",
    });
    const texts = [
      ...sent.push.map((p) => `${p.title} ${p.body}`),
      ...sent.email.map((e) => `${e.subject} ${e.text}`),
      ...sent.whatsapp.map((placeholders) => placeholders.join(" ")),
    ];
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) expect(text).not.toMatch(ENGLISH);
    expect(sent.whatsapp).toContainEqual(["Un utilisateur Keeplas"]);
    expect(sent.whatsapp).toContainEqual([
      "Un téléphone restauré depuis iCloud",
    ]);
  });
});

describe("email codes", () => {
  it("confirm an added email without mentioning a sign-in or a password", async () => {
    const sent = capture();
    const t = makeT();
    for (const language of ["en", "fr"]) {
      await t.action(internal.dispatch.sendEmailOtp, {
        email: "new@example.com",
        code: "123456",
        purpose: "verify_email",
        language,
      });
    }
    expect(sent.email.map((e) => e.subject)).toEqual([
      "Confirm your email for Keeplas",
      "Confirmez votre adresse e-mail pour Keeplas",
    ]);
    for (const { html, text } of sent.email) {
      expect(`${html} ${text}`).toContain("123456");
      expect(`${html} ${text}`).not.toMatch(
        /password|sign in|login|mot de passe|connexion/i,
      );
    }
  });

  it("mention a password only to accounts that have one", async () => {
    const sent = capture();
    const t = makeT();
    for (const purpose of ["sign_in", "password_login"] as const) {
      await t.action(internal.dispatch.sendEmailOtp, {
        email: "a@example.com",
        code: "123456",
        purpose,
      });
    }
    expect(sent.email[0].html).not.toMatch(/password/i);
    expect(sent.email[1].html).toContain("change your password");
  });
});
