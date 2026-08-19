import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrowseSkeleton } from "./browse-skeleton";

describe("BrowseSkeleton", () => {
  it("paints paper chrome without empty-state copy", () => {
    const { container } = render(<BrowseSkeleton />);
    const status = screen.getByRole("status", { name: "Loading places" });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Add a place to start a city.")).not.toBeInTheDocument();
    expect(screen.queryByText("No saved place matches this search.")).not.toBeInTheDocument();
    expect(container.innerHTML).toContain("var(--paper)");
    expect(container.innerHTML).toContain("var(--ink)");
    expect(container.innerHTML).not.toMatch(/bg-(gray|zinc|slate|stone)-/);
    expect(status.className).toMatch(/40vh/);
    expect(status.className).toMatch(/28rem/);
  });
});
