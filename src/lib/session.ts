import { cache } from "react";
import { headers } from "next/headers";
import { db } from "@/db";
import { allowedEmails } from "@/db/schema";
import {
  isEmailAllowed,
  parseAllowedEmailsEnv,
} from "./allowlist";
import { auth } from "./auth";

export type AllowedUser = { id: string; email: string; name: string };

export function evaluateSession(input: {
  email: string | null;
  envValue: string | undefined;
  tableEmails: string[];
}): { ok: true } | { ok: false; reason: "unauthenticated" | "not_invited" } {
  if (!input.email) return { ok: false, reason: "unauthenticated" };
  const envList = parseAllowedEmailsEnv(input.envValue);
  if (!isEmailAllowed(input.email, envList, input.tableEmails)) {
    return { ok: false, reason: "not_invited" };
  }
  return { ok: true };
}

export const getAllowedSession = cache(async (): Promise<
  | { ok: true; user: AllowedUser }
  | { ok: false; reason: "unauthenticated" | "not_invited" }
> => {
  const session = await auth.api.getSession({ headers: await headers() });
  const email = session?.user.email ?? null;
  const tableRows = await db.select().from(allowedEmails);
  const decision = evaluateSession({
    email,
    envValue: process.env.ALLOWED_EMAILS,
    tableEmails: tableRows.map((r) => r.email),
  });
  if (!decision.ok) return decision;
  return {
    ok: true,
    user: {
      id: session!.user.id,
      email: session!.user.email,
      name: session!.user.name,
    },
  };
});
