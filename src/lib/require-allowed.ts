import { getAllowedSession } from "./session";

export async function requireAllowedSession() {
  const session = await getAllowedSession();
  if (!session.ok) {
    const error = new Error(session.reason) as Error & { status: number };
    error.status = session.reason === "unauthenticated" ? 401 : 403;
    throw error;
  }
  return session.user;
}
