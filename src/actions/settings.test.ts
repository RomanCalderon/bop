import { describe, expect, it } from "vitest";
import { allowedEmails } from "@/db/schema";
import { createTestDb } from "@/test/pglite";
import {
  inviteEmailWithDeps,
  listAllowedEmailsWithDeps,
  removeAllowedEmailWithDeps,
} from "./settings";

describe("allowlist settings", () => {
  it("inviting an already-allowed email is a no-op", async () => {
    const { db, client } = await createTestDb();
    const first = await inviteEmailWithDeps(db, "Ada@X.com", "zoe@x.com");
    const second = await inviteEmailWithDeps(db, "ada@x.com", "zoe@x.com");
    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    const rows = await db.select().from(allowedEmails);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("ada@x.com");
    await client.close();
  });

  it("cannot remove an env email", async () => {
    const { db, client } = await createTestDb();
    const result = await removeAllowedEmailWithDeps(
      db,
      "ada@x.com",
      "ada@x.com",
    );
    expect(result).toEqual({
      ok: false,
      message: "That email is allowed by the server list.",
    });
    await client.close();
  });

  it("lists env and table separately", async () => {
    const { db, client } = await createTestDb();
    await inviteEmailWithDeps(db, "bob@x.com", "ada@x.com");
    const listed = await listAllowedEmailsWithDeps(db, "ada@x.com");
    expect(listed.env).toEqual(["ada@x.com"]);
    expect(listed.table).toEqual(["bob@x.com"]);
    await client.close();
  });
});
