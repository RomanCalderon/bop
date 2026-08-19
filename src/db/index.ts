import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

export function createDb(url: string) {
  return drizzle(neon(url), { schema });
}

export const db = createDb(
  process.env.DATABASE_URL ?? "postgresql://user:password@localhost/dbname",
);

export type BopDb =
  | NeonHttpDatabase<typeof schema>
  | PgliteDatabase<typeof schema>;
