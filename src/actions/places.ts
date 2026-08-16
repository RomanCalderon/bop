"use server";

import { db } from "@/db";
import type { BopDb } from "@/db";
import { insertPlace } from "@/lib/place-insert";
import { createPlacesClient } from "@/lib/places";
import type {
  AutocompleteSuggestion,
  BrowsePlace,
  PlacesPort,
} from "@/lib/places-types";
import { requireAllowedSession } from "@/lib/require-allowed";
import { toBrowsePlace } from "@/actions/place-view";

export async function addPlaceWithDeps(opts: {
  db: BopDb;
  places: PlacesPort;
  placeId: string;
  currentCityId: string | null;
}): Promise<
  | { ok: true; place: BrowsePlace; created: boolean }
  | { ok: false; message: string }
> {
  const details = await opts.places.getDetails(opts.placeId);
  if (!details) return { ok: false, message: "Couldn't save, try again." };
  const inferredMissing = !details.addressComponents.some(
    (c) =>
      c.types.includes("locality") ||
      c.types.includes("administrative_area_level_1"),
  );
  if (inferredMissing && opts.currentCityId === null) {
    return { ok: false, message: "Couldn't save, try again." };
  }
  const result = await insertPlace(opts.db, {
    details,
    notes: "",
    cityPolicy:
      opts.currentCityId === null
        ? { type: "seed" }
        : { type: "in-app", currentCityId: opts.currentCityId },
  });
  if (!result.ok) return { ok: false, message: "Couldn't save, try again." };
  return {
    ok: true,
    place: await toBrowsePlace(opts.db, result.place),
    created: result.created,
  };
}

export async function searchPlaces(input: string): Promise<
  | { ok: true; suggestions: AutocompleteSuggestion[] }
  | { ok: false; message: string }
> {
  try {
    await requireAllowedSession();
    const suggestions = await createPlacesClient(
      process.env.GOOGLE_PLACES_SERVER_KEY ?? "",
    ).autocomplete(input);
    return { ok: true, suggestions };
  } catch {
    return {
      ok: false,
      message: "Couldn't find that — try a more specific name.",
    };
  }
}

export async function addPlace(
  placeId: string,
  currentCityId: string | null,
): Promise<
  | { ok: true; place: BrowsePlace; created: boolean }
  | { ok: false; message: string }
> {
  try {
    await requireAllowedSession();
    return await addPlaceWithDeps({
      db,
      places: createPlacesClient(process.env.GOOGLE_PLACES_SERVER_KEY ?? ""),
      placeId,
      currentCityId,
    });
  } catch {
    return { ok: false, message: "Couldn't save, try again." };
  }
}
