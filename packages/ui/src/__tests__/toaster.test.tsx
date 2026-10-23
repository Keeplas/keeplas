import { describe, it, expect } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import { Toaster } from "../toaster";
import { toast } from "../use-toast";
import type { ToastVariant } from "../toast";

const VARIANTS: ToastVariant[] = ["default", "success", "error", "info"];

describe("Toaster", () => {
  it.each(VARIANTS)(
    "renders the %s variant on the shared v2 surface",
    (variant) => {
      render(<Toaster />);
      act(() => {
        toast({ variant, title: `Title ${variant}`, description: "Body" });
      });

      const title = screen.getByText(`Title ${variant}`);
      const root = title.closest("li")!;
      expect(root.className).toContain("bg-bg-surface");
      expect(root.className).toContain("border-border-default");
      expect(root.className).not.toMatch(
        /bg-(secondary|primary|error-container|surface-container)/,
      );
      expect(title.className).toContain("text-text-primary");
      expect(within(root).getByText("Body").className).toContain(
        "text-text-body",
      );
    },
  );

  it("colors the icon from the variant's status token", () => {
    render(<Toaster />);
    act(() => {
      toast({ variant: "error", title: "Failed" });
    });

    const root = screen.getByText("Failed").closest("li")!;
    expect(root.querySelector("svg")!.getAttribute("class")).toContain(
      "text-action-danger",
    );
  });
});
