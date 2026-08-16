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
});
