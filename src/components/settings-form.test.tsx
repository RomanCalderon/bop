import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsForm } from "./settings-form";

const { signOut, replace, refresh } = vi.hoisted(() => ({
  signOut: vi.fn(async () => ({ error: null })),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

const baseProps = {
  envEmails: ["ada@x.com"],
  tableEmails: ["bob@x.com"],
  cities: [{ id: "c1", name: "Austin" }],
  userEmail: "ada@x.com",
};

describe("SettingsForm", () => {
  it("starts on Cities and hides invite and account until selected", async () => {
    const user = userEvent.setup();
    render(
      <SettingsForm
        {...baseProps}
        inviteEmail={async () => ({ ok: true })}
        removeAllowedEmail={async () => ({ ok: true })}
        renameCity={async () => ({ ok: true })}
      />,
    );
    expect(screen.getByRole("tab", { name: "Cities" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByDisplayValue("Austin")).toBeInTheDocument();
    expect(screen.queryByLabelText("Invite email")).toBeNull();
    expect(screen.queryByRole("button", { name: "Log out" })).toBeNull();

    await user.click(screen.getByRole("tab", { name: "Invite" }));
    expect(screen.getByLabelText("Invite email")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Austin")).toBeNull();

    await user.click(screen.getByRole("tab", { name: "Account" }));
    expect(screen.getByText("ada@x.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("invites an email and does not offer remove on env emails", async () => {
    const user = userEvent.setup();
    const inviteEmail = vi.fn(async () => ({ ok: true as const }));
    render(
      <SettingsForm
        {...baseProps}
        inviteEmail={inviteEmail}
        removeAllowedEmail={async () => ({ ok: true })}
        renameCity={async () => ({ ok: true })}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Invite" }));
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
        {...baseProps}
        inviteEmail={inviteEmail}
        removeAllowedEmail={removeAllowedEmail}
        renameCity={renameCity}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Invite" }));
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

    await user.click(screen.getByRole("tab", { name: "Cities" }));
    const cityInput = screen.getByDisplayValue("Austin");
    await user.clear(cityInput);
    await user.type(cityInput, "Chicago");
    await user.tab();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A city with that name already exists.",
    );
  });

  it("signs out from the account tab", async () => {
    const user = userEvent.setup();
    render(
      <SettingsForm
        {...baseProps}
        inviteEmail={async () => ({ ok: true })}
        removeAllowedEmail={async () => ({ ok: true })}
        renameCity={async () => ({ ok: true })}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Account" }));
    await user.click(screen.getByRole("button", { name: "Log out" }));
    expect(signOut).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/sign-in");
    expect(refresh).toHaveBeenCalled();
  });
});
