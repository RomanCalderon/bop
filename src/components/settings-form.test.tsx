import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsForm } from "./settings-form";

describe("SettingsForm", () => {
  it("invites an email and does not offer remove on env emails", async () => {
    const user = userEvent.setup();
    const inviteEmail = vi.fn(async () => ({ ok: true as const }));
    render(
      <SettingsForm
        envEmails={["ada@x.com"]}
        tableEmails={["bob@x.com"]}
        cities={[{ id: "c1", name: "Austin" }]}
        inviteEmail={inviteEmail}
        removeAllowedEmail={async () => ({ ok: true })}
        renameCity={async () => ({ ok: true })}
      />,
    );
    expect(screen.queryByRole("button", { name: "Remove ada@x.com" })).toBeNull();
    expect(screen.getByRole("button", { name: "Remove bob@x.com" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Invite email"), "cai@x.com");
    await user.click(screen.getByRole("button", { name: "Invite" }));
    expect(inviteEmail).toHaveBeenCalledWith("cai@x.com");
  });

  it("shows action errors and does not append an env email on a no-op invite", async () => {
    const user = userEvent.setup();
    const inviteEmail = vi.fn(async (value: string) => {
      if (value === "ada@x.com") return { ok: true as const };
      return { ok: false as const, message: "Enter a valid email." };
    });
    const removeAllowedEmail = vi.fn(async () => ({
      ok: false as const,
      message: "That email is allowed by the server list.",
    }));
    const renameCity = vi.fn(async () => ({
      ok: false as const,
      message: "A city with that name already exists.",
    }));
    render(
      <SettingsForm
        envEmails={["ada@x.com"]}
        tableEmails={["bob@x.com"]}
        cities={[{ id: "c1", name: "Austin" }]}
        inviteEmail={inviteEmail}
        removeAllowedEmail={removeAllowedEmail}
        renameCity={renameCity}
      />,
    );
    await user.type(screen.getByLabelText("Invite email"), "nope");
    await user.click(screen.getByRole("button", { name: "Invite" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email.");

    await user.clear(screen.getByLabelText("Invite email"));
    await user.type(screen.getByLabelText("Invite email"), "ada@x.com");
    await user.click(screen.getByRole("button", { name: "Invite" }));
    expect(screen.queryByRole("button", { name: "Remove ada@x.com" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Remove bob@x.com" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "That email is allowed by the server list.",
    );
    expect(screen.getByRole("button", { name: "Remove bob@x.com" })).toBeInTheDocument();

    const cityInput = screen.getByDisplayValue("Austin");
    await user.clear(cityInput);
    await user.type(cityInput, "Chicago");
    await user.tab();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A city with that name already exists.",
    );
  });
});
