"use server";

import { and, eq, sql } from "drizzle-orm";
import { db, type BopDb } from "@/db";
import { allowedEmails, areas, cities } from "@/db/schema";
import {
  isEmailAllowed,
  normalizeEmail,
  parseAllowedEmailsEnv,
} from "@/lib/allowlist";
import { requireAllowedSession } from "@/lib/require-allowed";

export async function inviteEmailWithDeps(
  database: BopDb,
  email: string,
  envValue: string | undefined,
) {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) {
    return { ok: false as const, message: "Enter a valid email." };
  }
  const envList = parseAllowedEmailsEnv(envValue);
  const table = await database.select().from(allowedEmails);
  if (isEmailAllowed(normalized, envList, table.map((r) => r.email))) {
    return { ok: true as const };
  }
  await database.insert(allowedEmails).values({
    id: crypto.randomUUID(),
    email: normalized,
  });
  return { ok: true as const };
}

export async function removeAllowedEmailWithDeps(
  database: BopDb,
  email: string,
  envValue: string | undefined,
) {
  const normalized = normalizeEmail(email);
  if (parseAllowedEmailsEnv(envValue).includes(normalized)) {
    return {
      ok: false as const,
      message: "That email is allowed by the server list.",
    };
  }
  await database.delete(allowedEmails).where(eq(allowedEmails.email, normalized));
  return { ok: true as const };
}

export async function listAllowedEmailsWithDeps(
  database: BopDb,
  envValue: string | undefined,
) {
  const env = parseAllowedEmailsEnv(envValue);
  const table = (await database.select().from(allowedEmails)).map((r) => r.email);
  return { env, table };
}

export async function renameCityWithDeps(
  database: BopDb,
  cityId: string,
  name: string,
) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, message: "Name required." };
  try {
    await database.update(cities).set({ name: trimmed }).where(eq(cities.id, cityId));
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "A city with that name already exists." };
  }
}

export async function createAreaWithDeps(
  database: BopDb,
  cityId: string,
  name: string,
) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, message: "Name required." };
  const existing = await database
    .select()
    .from(areas)
    .where(
      and(
        eq(areas.cityId, cityId),
        sql`lower(${areas.name}) = ${trimmed.toLowerCase()}`,
      ),
    )
    .limit(1);
  if (existing[0]) {
    return { ok: true as const, area: { id: existing[0].id, name: existing[0].name } };
  }
  const id = crypto.randomUUID();
  await database.insert(areas).values({ id, cityId, name: trimmed });
  return { ok: true as const, area: { id, name: trimmed } };
}

export async function inviteEmail(email: string) {
  try {
    await requireAllowedSession();
    return await inviteEmailWithDeps(db, email, process.env.ALLOWED_EMAILS);
  } catch {
    return { ok: false as const, message: "Couldn't save, try again." };
  }
}

export async function removeAllowedEmail(email: string) {
  try {
    await requireAllowedSession();
    return await removeAllowedEmailWithDeps(db, email, process.env.ALLOWED_EMAILS);
  } catch {
    return { ok: false as const, message: "Couldn't save, try again." };
  }
}

export async function listAllowedEmails() {
  await requireAllowedSession();
  return listAllowedEmailsWithDeps(db, process.env.ALLOWED_EMAILS);
}

export async function renameCity(cityId: string, name: string) {
  try {
    await requireAllowedSession();
    return await renameCityWithDeps(db, cityId, name);
  } catch {
    return { ok: false as const, message: "Couldn't save, try again." };
  }
}

export async function createArea(cityId: string, name: string) {
  try {
    await requireAllowedSession();
    return await createAreaWithDeps(db, cityId, name);
  } catch {
    return { ok: false as const, message: "Couldn't save, try again." };
  }
}
