import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { social: vi.fn() } },
}));

import SignInPage from "./page";

describe("SignInPage", () => {
  it("renders the Google sign-in action", () => {
    render(<SignInPage />);
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument();
  });
});
