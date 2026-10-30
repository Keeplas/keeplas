import { ConvexError } from "convex/values";
import { Password } from "@convex-dev/auth/providers/Password";
import {
  ConvexCredentials,
  type ConvexCredentialsUserConfig,
} from "@convex-dev/auth/providers/ConvexCredentials";
import {
  convexAuth,
  createAccount,
  retrieveAccount,
  type ConvexCredentialsConfig,
  type GenericActionCtxWithAuthConfig,
} from "@convex-dev/auth/server";
import type { DataModel, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import type { AuditContext } from "./audit";
import { verifyAssertionAndGetUserId } from "./webauthn";
import { normalizeE164 } from "./lib/phone";
import { normalizeEmail } from "./lib/email";
import { normalizeUserLanguage } from "./lib/locale";
import { assertStrongPassword } from "./lib/password";
import { refuseNonMobileSignUp } from "./attestation";

// Maps the sign-up provider id to the initial auth method recorded on the
// user. The passkey + recovery credential providers never create a user, so
// they're absent; "passkey"/"totp" are added later on enrollment.
const INITIAL_AUTH_METHOD: Record<string, "email" | "phone"> = {
  password: "email",
  "email-otp": "email",
  "phone-otp": "phone",
};

/**
 * Sign in on a session that already holds what the credentials proved
 * (session_proofs.ts): "phone" for a WhatsApp code that just reached the
 * number, "vault" for a matching 24-word verifier.
 */
async function provenSignIn(
  ctx: GenericActionCtxWithAuthConfig<DataModel>,
  userId: Id<"users">,
  kind: "phone" | "vault",
) {
  const sessionId = await ctx.runMutation(
    internal.session_proofs.openProvenSession,
    { userId, kind },
  );
  return { userId, sessionId };
}

/**
 * Run `before` ahead of a library-built credentials provider (Password). The
 * library keeps the provider's real config, `authorize` included, under
 * `options` and merges it in when it materializes the providers.
 */
type Authorize = ConvexCredentialsUserConfig<DataModel>["authorize"];

function beforeAuthorize(
  provider: ConvexCredentialsConfig,
  before: (...args: Parameters<Authorize>) => Promise<void>,
): ConvexCredentialsConfig {
  const { options } = provider as unknown as {
    options: { authorize: Authorize };
  };
  const authorize: Authorize = async (params, ctx) => {
    await before(params, ctx);
    return options.authorize(params, ctx);
  };
  return {
    ...provider,
    options: { ...options, authorize },
  } as ConvexCredentialsConfig;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  callbacks: {
    // @convex-dev/auth never sets our custom user fields. Stamp account
    // defaults exactly once, when the row is first created (existingUserId is
    // null). Skipping later sign-in/verification passes is what keeps the
    // authProviders entries added by passkey/TOTP enrollment from being
    // clobbered (the default flow re-patches `profile()` onto existing users).
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId, provider }) {
      if (existingUserId !== null) return;
      const method = INITIAL_AUTH_METHOD[provider.id];
      await ctx.db.patch(userId, {
        ...(method ? { authProviders: [method] } : {}),
      });
    },
  },
  providers: [
    // Email-keyed account (password + always-on login-OTP via email).
    // `profile().email` is the account identifier. Optional phone is
    // captured for day-one WhatsApp/Life Check (verified in onboarding).
    // No `verify` provider: the library's "email-verification" flow would
    // sign in with an emailed 6-digit code alone, never checking the
    // password. Every call carries the sealed `_audit` envelope and counts
    // against a per-IP budget (the library only limits failures per account).
    beforeAuthorize(
      Password({
        // Authoritative strength gate — enforced on sign-up and password reset,
        // never on plain sign-in (existing accounts are not re-validated).
        validatePasswordRequirements: assertStrongPassword,
        profile(params) {
          refuseNonMobileSignUp(params.flow);
          let phoneNumber: string | undefined;
          try {
            phoneNumber = normalizeE164(
              params.phoneNumber as string | undefined,
            );
          } catch {
            phoneNumber = undefined;
          }
          const name = params.name as string | undefined;
          const language = normalizeUserLanguage(
            params.language as string | undefined,
          );
          return {
            email: params.email as string,
            ...(name ? { name } : {}),
            ...(phoneNumber ? { phoneNumber } : {}),
            language,
          };
        },
      }),
      async (params, ctx) => {
        await ctx.runMutation(internal.email_auth.throttlePasswordSignIn, {
          _audit: params._audit as AuditContext,
        });
      },
    ),
    // Passwordless phone account. Sign-up/sign-in = phone + WhatsApp OTP.
    // Sign-up codes are only issued after a mobile attestation (M09-9), and a
    // code is only valid for the flow it was issued for. The pre-auth code is
    // issued by `phone_auth.requestPhoneAuthOtp` and
    // consumed here. `createAccount`/`retrieveAccount` manage the account +
    // user with NO secret, keying on the E.164 phone. `users.email` stays
    // undefined for these accounts.
    ConvexCredentials({
      id: "phone-otp",
      authorize: async (credentials, ctx) => {
        const phone = normalizeE164(credentials.phoneNumber as string);
        if (!phone) throw new Error("A valid phone number is required");
        const code = String(credentials.code ?? "");

        const check = await ctx.runMutation(
          internal.phone_auth.consumePhoneAuthCode,
          {
            phoneNumber: phone,
            code,
            intent: credentials.flow === "signUp" ? "signup" : "signin",
          },
        );
        if (!check.ok) throw new ConvexError(check.error);

        if (credentials.flow === "signUp") {
          const name = (credentials.name as string | undefined)?.trim();
          const language = normalizeUserLanguage(
            credentials.language as string | undefined,
          );
          const { user } = await createAccount(ctx, {
            provider: "phone-otp",
            account: { id: phone },
            profile: {
              phoneNumber: phone,
              phoneNumberVerifiedAt: Date.now(),
              language,
              ...(name ? { name } : {}),
            },
          });
          return provenSignIn(ctx, user._id, "phone");
        }

        const { user } = await retrieveAccount(ctx, {
          provider: "phone-otp",
          account: { id: phone },
        });
        return provenSignIn(ctx, user._id, "phone");
      },
    }),
    // Passwordless email sign-in, sibling of `phone-otp`: email + a one-time
    // emailed code (no password), issued by `email_auth.requestEmailAuthOtp`
    // and consumed here. Sign-in only (sign-up is mobile-only, F8): existing
    // email accounts and phone accounts that linked an email from settings.
    ConvexCredentials({
      id: "email-otp",
      authorize: async (credentials, ctx) => {
        const email = normalizeEmail(credentials.email as string);
        if (!email) throw new Error("A valid email is required");
        const code = String(credentials.code ?? "");

        refuseNonMobileSignUp(credentials.flow);
        const check = await ctx.runMutation(
          internal.email_auth.consumeEmailAuthCode,
          { email, code },
        );
        if (!check.ok) throw new ConvexError(check.error);

        const { user } = await retrieveAccount(ctx, {
          provider: "email-otp",
          account: { id: email },
        });
        return { userId: user._id };
      },
    }),
    // Lost-phone recovery for passwordless phone accounts: 24-word phrase
    // hash → session (no WhatsApp code needed). The user can then update
    // their number from settings. ZK unchanged (hash comparison only).
    ConvexCredentials({
      id: "phone-recovery",
      authorize: async (credentials, ctx) => {
        const phone = normalizeE164(credentials.phoneNumber as string);
        if (!phone) throw new Error("A valid phone number is required");
        const phraseHash = String(credentials.phraseHash ?? "");
        const userId = await ctx.runQuery(
          internal.phone_auth.verifyPhoneRecovery,
          { phoneNumber: phone, phraseHash },
        );
        if (!userId) throw new Error("Invalid recovery phrase");
        return provenSignIn(ctx, userId, "vault");
      },
    }),
    // Recovery for passwordless email accounts (sibling of `phone-recovery`):
    // 24-word phrase hash → session, when the email-otp channel is unreachable.
    // ZK unchanged (hash comparison only).
    ConvexCredentials({
      id: "email-recovery",
      authorize: async (credentials, ctx) => {
        const email = normalizeEmail(credentials.email as string);
        if (!email) throw new Error("A valid email is required");
        const phraseHash = String(credentials.phraseHash ?? "");
        const userId = await ctx.runQuery(
          internal.email_auth.verifyEmailRecovery,
          { email, phraseHash },
        );
        if (!userId) throw new Error("Invalid recovery phrase");
        return provenSignIn(ctx, userId, "vault");
      },
    }),
    // Lost number, no 24 words: an approved lost-number request past its
    // 72 h window plus the WhatsApp code sent to the new number move the
    // account to it and sign in (number_change.ts). Never creates a user.
    ConvexCredentials({
      id: "number-change",
      authorize: async (credentials, ctx) => {
        const result = await ctx.runMutation(internal.number_change.complete, {
          requestId: String(
            credentials.requestId ?? "",
          ) as Id<"number_change_requests">,
          claimToken: String(credentials.claimToken ?? ""),
          code: String(credentials.code ?? ""),
        });
        if (!result.ok) throw new ConvexError(result.error);
        return provenSignIn(ctx, result.userId, "phone");
      },
    }),
    // QR pairing (workflow 8): a browser approved by the owner's phone signs
    // in with the login secret it generated at `pairing.create`. Never creates
    // a user; the session belongs to the approving account.
    ConvexCredentials({
      id: "pairing",
      authorize: async (credentials, ctx) => {
        const userId = await ctx.runMutation(
          internal.pairing.redeemLoginToken,
          {
            sessionId: String(credentials.sessionId ?? ""),
            secret: String(credentials.secret ?? ""),
          },
        );
        return { userId };
      },
    }),
    ConvexCredentials({
      id: "passkey",
      authorize: async (credentials, ctx) => {
        const response = credentials.response;
        if (!response || typeof response !== "object") {
          throw new Error("Missing passkey response");
        }
        const userId = await verifyAssertionAndGetUserId(ctx, response);
        return { userId };
      },
    }),
  ],
});
