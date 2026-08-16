import { redirect } from "next/navigation";
import { getAllowedSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getAllowedSession();
  if (!session.ok && session.reason === "unauthenticated") {
    redirect("/sign-in");
  }
  if (!session.ok && session.reason === "not_invited") {
    redirect("/not-invited");
  }
  return <main>Bop</main>;
}
