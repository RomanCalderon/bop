import { describe, expect, it } from "vitest";
import {
  isEmailAllowed,
  normalizeEmail,
  parseAllowedEmailsEnv,
} from "./allowlist";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
});

describe("parseAllowedEmailsEnv", () => {
  it("splits on commas and normalizes", () => {
    expect(parseAllowedEmailsEnv(" Ada@x.com, bob@Y.com ")).toEqual([
      "ada@x.com",
      "bob@y.com",
    ]);
  });

  it("returns empty for undefined or blank", () => {
    expect(parseAllowedEmailsEnv(undefined)).toEqual([]);
    expect(parseAllowedEmailsEnv("  ")).toEqual([]);
  });
});

describe("isEmailAllowed", () => {
  it("honors env even when the table is empty", () => {
    expect(
      isEmailAllowed("Ada@x.com", parseAllowedEmailsEnv("ada@x.com"), []),
    ).toBe(true);
  });

  it("honors a table row when env is empty", () => {
    expect(isEmailAllowed("ada@x.com", [], ["ada@x.com"])).toBe(true);
  });

  it("is the union of env and table", () => {
    expect(isEmailAllowed("a@x.com", ["a@x.com"], ["b@x.com"])).toBe(true);
    expect(isEmailAllowed("b@x.com", ["a@x.com"], ["b@x.com"])).toBe(true);
  });

  it("fails closed for unknown mail", () => {
    expect(isEmailAllowed("eve@x.com", ["ada@x.com"], ["bob@x.com"])).toBe(
      false,
    );
  });

  it("normalizes Google, env, and table values before compare", () => {
    expect(
      isEmailAllowed("  ADA@X.com ", ["Ada@x.com"], ["  Bob@X.COM "]),
    ).toBe(true);
    expect(
      isEmailAllowed("bob@x.com", ["ada@x.com"], ["  Bob@X.COM "]),
    ).toBe(true);
  });
});
