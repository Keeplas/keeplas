import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const confirm = vi.fn(async () => "ok" as const);

vi.mock("convex/react", () => ({ useAction: () => confirm }));
vi.mock("@/lib/navigation", () => ({
  useSearchParams: () => new URLSearchParams("token=signed-token"),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/app/(auth)/components/auth-hero-section", () => ({
  AuthHeroSection: () => null,
}));
vi.mock("@/app/(auth)/components/mobile-brand", () => ({
  MobileBrand: () => null,
}));

import LifeCheckConfirmPage from "@/app/life-check/confirm/page";

// Finding 30: mail scanners and link previews open the check-in link with no
// person behind it, so loading the page must not confirm anything.
describe("Life Check email confirm page", () => {
  beforeEach(() => {
    confirm.mockClear();
  });

  it("asks for an explicit click and confirms nothing on load", async () => {
    render(<LifeCheckConfirmPage />);

    expect(screen.getByRole("button", { name: "confirm" })).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(confirm).not.toHaveBeenCalled();
  });

  it("confirms with the link's token when the user clicks", async () => {
    render(<LifeCheckConfirmPage />);

    fireEvent.click(screen.getByRole("button", { name: "confirm" }));

    await waitFor(() => expect(screen.getByText("okTitle")).toBeVisible());
    expect(confirm).toHaveBeenCalledWith({ token: "signed-token" });
  });
});
