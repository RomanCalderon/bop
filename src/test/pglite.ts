import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";

export async function createTestDb() {
  const client = new PGlite();
  const sql = readFileSync(path.join(process.cwd(), "src/db/init.sql"), "utf8");
  await client.exec(sql);
  const db = drizzle(client, { schema });
  return { db, client };
}
