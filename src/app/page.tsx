import { redirect } from "next/navigation";
import { addPlace, deletePlace, movePlace, searchPlaces, updatePlace } from "@/actions/places";
import { changeCity, getBrowsePayload } from "@/actions/browse";
import { createArea } from "@/actions/settings";
import { AppShell } from "@/components/app-shell";
import { getAllowedSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getAllowedSession();
  if (!session.ok && session.reason === "unauthenticated") redirect("/sign-in");
  if (!session.ok && session.reason === "not_invited") redirect("/not-invited");
  const initial = await getBrowsePayload();
  return (
    <AppShell
      initial={initial}
      onCityChange={changeCity}
      searchPlaces={searchPlaces}
      addPlace={addPlace}
      updatePlace={updatePlace}
      deletePlace={deletePlace}
      movePlace={movePlace}
      createArea={createArea}
    />
  );
}
