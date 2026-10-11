import { describe, expect, it } from "vitest";
import { sessionIdFromToken } from "../session";

const jwt = (payload: object) =>
  `header.${btoa(JSON.stringify(payload)).replace(/=+$/, "")}.signature`;

describe("sessionIdFromToken", () => {
  it("reads the session from the Convex Auth sub claim", () => {
    expect(sessionIdFromToken(jwt({ sub: "user123|session456" }))).toBe(
      "session456",
    );
  });

  it.each([
    [null],
    ["not-a-jwt"],
    [jwt({})],
    [jwt({ sub: "user-only" })],
    ["a.%%%.c"],
  ])("returns null for %s", (token) => {
    expect(sessionIdFromToken(token)).toBeNull();
  });
});
