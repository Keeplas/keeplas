import { ConvexError } from "convex/values";

import { inviteErrorKey } from "../invite-error";

describe("inviteErrorKey", () => {
  it("names the refusals the server explains", () => {
    const key = (message: string) =>
      inviteErrorKey(new ConvexError(message), "people.inviteFailed");

    expect(key("You can't add yourself as a trusted contact")).toBe(
      "people.selfInvite",
    );
    expect(
      key("Too many invitations to this person today. Try again tomorrow."),
    ).toBe("people.tooManyInvites");
    expect(key("A contact with this phone number already exists")).toBe(
      "people.alreadyInvited",
    );
    expect(key("This person is already one of your contacts")).toBe(
      "people.alreadyInvited",
    );
  });

  it("falls back for network and unexpected errors", () => {
    expect(
      inviteErrorKey(
        new Error("[CONVEX M(trusted_contacts:invite)] Server Error"),
        "people.saveFailed",
      ),
    ).toBe("people.saveFailed");
  });
});
