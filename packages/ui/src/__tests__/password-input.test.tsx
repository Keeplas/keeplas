import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PasswordInput } from "../password-input";

describe("PasswordInput", () => {
  it("hides the value until the eye is pressed, then hides it again", () => {
    render(
      <PasswordInput
        aria-label="PIN"
        defaultValue="123456"
        showLabel="Show"
        hideLabel="Hide"
      />,
    );
    const input = screen.getByLabelText("PIN");
    expect(input).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(input).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(input).toHaveAttribute("type", "password");
  });
});
