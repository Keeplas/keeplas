import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTP } from "./ResendOTP";
import { verifyAssertionAndGetUserId } from "./webauthn";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({ verify: ResendOTP }),
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
