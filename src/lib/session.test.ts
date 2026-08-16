import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { select: () => ({ from: () => [] }) },
}));

vi.mock("./auth", () => ({
  auth: { api: { getSession: async () => null } },
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

import { evaluateSession } from "./session";

describe("evaluateSession", () => {
  it("is unauthenticated when there is no session user", () => {
    expect(
      evaluateSession({
        email: null,
        envValue: "ada@x.com",
        tableEmails: [],
      }),
    ).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("is not_invited when the Google email is outside env ∪ table", () => {
    expect(
      evaluateSession({
        email: "eve@x.com",
        envValue: "ada@x.com",
        tableEmails: ["bob@x.com"],
      }),
    ).toEqual({ ok: false, reason: "not_invited" });
  });

  it("allows an env email and a table email after normalize", () => {
    expect(
      evaluateSession({
        email: "  ADA@X.com ",
        envValue: "Ada@x.com",
        tableEmails: [],
      }).ok,
    ).toBe(true);
    expect(
      evaluateSession({
        email: "bob@x.com",
        envValue: "",
        tableEmails: ["  Bob@X.COM "],
      }).ok,
    ).toBe(true);
  });
});
