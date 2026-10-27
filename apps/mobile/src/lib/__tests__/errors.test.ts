import { ConvexError } from "convex/values";

import { serverMessage } from "../errors";

describe("serverMessage", () => {
  it("returns the message the server wrote", () => {
    expect(serverMessage(new ConvexError("This invitation has expired"))).toBe(
      "This invitation has expired",
    );
  });

  it("hides request IDs, OS codes and structured server data", () => {
    expect(
      serverMessage(
        new Error(
          "[CONVEX M(trusted_contacts:accept)] [Request ID: 1a2b] Server Error",
        ),
      ),
    ).toBeUndefined();
    expect(
      serverMessage(new Error("Keychain write failed (OSStatus -34018)")),
    ).toBeUndefined();
    expect(serverMessage(new ConvexError({ code: "LIMIT" }))).toBeUndefined();
  });
});
