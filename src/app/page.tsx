import { redirect } from "next/navigation";
import { changeCity, getBrowsePayload } from "@/actions/browse";
import { BrowseApp } from "@/components/browse-app";
import { getAllowedSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getAllowedSession();
  if (!session.ok && session.reason === "unauthenticated") redirect("/sign-in");
  if (!session.ok && session.reason === "not_invited") redirect("/not-invited");
  const initial = await getBrowsePayload();
  return (
    <BrowseApp
      payload={initial}
      onCityChange={changeCity}
    />
  );
}
