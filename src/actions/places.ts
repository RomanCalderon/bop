"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import type { BopDb } from "@/db";
import { places } from "@/db/schema";
import { insertPlace } from "@/lib/place-insert";
import { createPlacesClient } from "@/lib/places";
import type {
  AutocompleteSuggestion,
  BrowsePlace,
  PlacesPort,
} from "@/lib/places-types";
import { requireAllowedSession } from "@/lib/require-allowed";
import { toBrowsePlace, toPlaceRow } from "@/actions/place-view";

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

export async function updatePlaceWithDeps(
  database: BopDb,
  id: string,
  patch: {
    notes?: string;
    extraTags?: string[];
    type?: string | null;
    areaId?: string | null;
    cityId?: string;
  },
) {
  const [current] = await database.select().from(places).where(eq(places.id, id));
  if (!current) return { ok: false as const, message: "Place not found." };
  if (patch.cityId && patch.cityId !== current.cityId) {
    return movePlaceWithDeps(database, id, patch.cityId);
  }
  await database
    .update(places)
    .set({
      notes: patch.notes ?? current.notes,
      extraTags: patch.extraTags ?? current.extraTags,
      type: patch.type === undefined ? current.type : patch.type,
      areaId: patch.areaId === undefined ? current.areaId : patch.areaId,
    })
    .where(eq(places.id, id));
  const [next] = await database.select().from(places).where(eq(places.id, id));
  return { ok: true as const, place: await toBrowsePlace(database, toPlaceRow(next!)) };
}

export async function movePlaceWithDeps(
  database: BopDb,
  id: string,
  toCityId: string,
) {
  const [current] = await database.select().from(places).where(eq(places.id, id));
  if (!current) return { ok: false as const, message: "Place not found." };
  const [dup] = await database
    .select()
    .from(places)
    .where(and(eq(places.placeId, current.placeId), eq(places.cityId, toCityId)));
  if (dup) {
    return {
      ok: false as const,
      message: "Already saved in that city.",
      existingPlaceId: dup.id,
    };
  }
  await database
    .update(places)
    .set({ cityId: toCityId, areaId: null })
    .where(eq(places.id, id));
  const [next] = await database.select().from(places).where(eq(places.id, id));
  return { ok: true as const, place: await toBrowsePlace(database, toPlaceRow(next!)) };
}

export async function deletePlaceWithDeps(database: BopDb, id: string) {
  await database.delete(places).where(eq(places.id, id));
  return { ok: true as const };
}

export async function updatePlace(
  id: string,
  patch: {
    notes?: string;
    extraTags?: string[];
    type?: string | null;
    areaId?: string | null;
    cityId?: string;
  },
) {
  try {
    await requireAllowedSession();
    return await updatePlaceWithDeps(db, id, patch);
  } catch {
    return { ok: false as const, message: "Couldn't save, try again." };
  }
}

export async function movePlace(id: string, toCityId: string) {
  try {
    await requireAllowedSession();
    return await movePlaceWithDeps(db, id, toCityId);
  } catch {
    return { ok: false as const, message: "Couldn't save, try again." };
  }
}

export async function deletePlace(id: string) {
  try {
    await requireAllowedSession();
    return await deletePlaceWithDeps(db, id);
  } catch {
    return { ok: false as const, message: "Couldn't save, try again." };
  }
}
