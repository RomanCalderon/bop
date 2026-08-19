"use server";

import { asc, count, eq } from "drizzle-orm";
import { db, type BopDb } from "@/db";
import { areas, cities, places, userPreferences } from "@/db/schema";
import { toPlaceRow } from "@/actions/place-view";
import type { BrowsePayload } from "@/lib/places-types";
import { requireAllowedSession } from "@/lib/require-allowed";

export async function getBrowsePayloadWithDeps(
  database: BopDb,
  userId: string,
  cityId: string | null,
): Promise<BrowsePayload> {
  const cityRows = await database
    .select({
      id: cities.id,
      name: cities.name,
      centerLat: cities.centerLat,
      centerLng: cities.centerLng,
      placeCount: count(places.id),
    })
    .from(cities)
    .leftJoin(places, eq(places.cityId, cities.id))
    .groupBy(cities.id)
    .orderBy(asc(cities.name));

  const listed = cityRows.map((c) => ({
    id: c.id,
    name: c.name,
    placeCount: Number(c.placeCount),
  }));

  const fromId = cityId ? cityRows.find((c) => c.id === cityId) : undefined;

  let requested = fromId ?? null;
  if (!requested) {
    const pref = await database
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);
    requested =
      (pref[0]?.lastCityId &&
        cityRows.find((c) => c.id === pref[0].lastCityId)) ||
      [...cityRows].sort((a, b) => {
        const byCount = Number(b.placeCount) - Number(a.placeCount);
        return byCount !== 0 ? byCount : a.name.localeCompare(b.name);
      })[0] ||
      null;
  }

  if (!requested) {
    return {
      city: null,
      cities: listed,
      places: [],
      types: [],
      areas: [],
      extraTags: [],
    };
  }

  const joined = await database
    .select({
      place: places,
      areaName: areas.name,
    })
    .from(places)
    .leftJoin(areas, eq(places.areaId, areas.id))
    .where(eq(places.cityId, requested.id));

  const browsePlaces = joined.map((row) => ({
    ...toPlaceRow(row.place),
    areaName: row.areaName ?? null,
  }));
  const types = [
    ...new Set(browsePlaces.map((p) => p.type).filter((t): t is string => Boolean(t))),
  ].sort();
  const extraTags = [...new Set(browsePlaces.flatMap((p) => p.extraTags))].sort();
  const areaById = new Map<string, string>();
  for (const row of joined) {
    if (row.place.areaId && row.areaName) {
      areaById.set(row.place.areaId, row.areaName);
    }
  }
  const cityAreas = [...areaById.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    city: {
      id: requested.id,
      name: requested.name,
      centerLat: requested.centerLat,
      centerLng: requested.centerLng,
    },
    cities: listed,
    places: browsePlaces,
    types,
    areas: cityAreas,
    extraTags,
  };
}

export async function listCitiesWithDeps(database: BopDb) {
  const rows = await database
    .select({ id: cities.id, name: cities.name })
    .from(cities)
    .orderBy(asc(cities.name));
  return rows;
}

export async function setLastCityWithDeps(
  database: BopDb,
  userId: string,
  cityId: string,
) {
  await database
    .insert(userPreferences)
    .values({ userId, lastCityId: cityId })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { lastCityId: cityId },
    });
  return { ok: true as const };
}

export async function getBrowsePayload(cityId?: string | null) {
  const session = await requireAllowedSession();
  return getBrowsePayloadWithDeps(db, session.id, cityId ?? null);
}

export async function setLastCity(cityId: string) {
  try {
    const session = await requireAllowedSession();
    return await setLastCityWithDeps(db, session.id, cityId);
  } catch {
    return { ok: false as const, message: "Couldn't save, try again." };
  }
}

export async function changeCity(cityId: string) {
  try {
    const session = await requireAllowedSession();
    await setLastCityWithDeps(db, session.id, cityId);
    return await getBrowsePayloadWithDeps(db, session.id, cityId);
  } catch {
    return { ok: false as const, message: "Couldn't save, try again." };
  }
}
