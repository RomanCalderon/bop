import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotInvitedPage from "./page";

describe("NotInvitedPage", () => {
  it("shows the not-invited copy and no place names", () => {
    render(<NotInvitedPage />);
    expect(screen.getByText("Not invited")).toBeInTheDocument();
    expect(screen.queryByText("Slant of Light Books")).toBeNull();
  });
});
