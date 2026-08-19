"use server";

import { asc, count, eq } from "drizzle-orm";
import { db, type BopDb } from "@/db";
import { areas, cities, places, userPreferences } from "@/db/schema";
import { toPlaceRow } from "@/actions/place-view";
import type { BrowsePayload, BrowsePlace } from "@/lib/places-types";
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
      id: places.id,
      placeId: places.placeId,
      name: places.name,
      lat: places.lat,
      lng: places.lng,
      formattedAddress: places.formattedAddress,
      cityId: places.cityId,
      areaId: places.areaId,
      type: places.type,
      extraTags: places.extraTags,
      notes: places.notes,
      photoName: places.photoName,
      areaName: areas.name,
    })
    .from(places)
    .leftJoin(areas, eq(places.areaId, areas.id))
    .where(eq(places.cityId, requested.id));

  const browsePlaces = joined.map((row) => ({
    id: row.id,
    placeId: row.placeId,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    formattedAddress: row.formattedAddress,
    cityId: row.cityId,
    areaId: row.areaId,
    areaName: row.areaName ?? null,
    type: row.type,
    extraTags: row.extraTags,
    notes: row.notes,
    photoName: row.photoName,
  }));
  const types = [
    ...new Set(browsePlaces.map((p) => p.type).filter((t): t is string => Boolean(t))),
  ].sort();
  const extraTags = [...new Set(browsePlaces.flatMap((p) => p.extraTags))].sort();
  const areaById = new Map<string, string>();
  for (const row of browsePlaces) {
    if (row.areaId && row.areaName) {
      areaById.set(row.areaId, row.areaName);
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

export async function getPlaceCardWithDeps(
  database: BopDb,
  placeId: string,
): Promise<BrowsePlace | null> {
  const rows = await database
    .select({
      place: places,
      areaName: areas.name,
    })
    .from(places)
    .leftJoin(areas, eq(places.areaId, areas.id))
    .where(eq(places.id, placeId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const full = toPlaceRow(row.place);
  return {
    id: full.id,
    placeId: full.placeId,
    name: full.name,
    lat: full.lat,
    lng: full.lng,
    formattedAddress: full.formattedAddress,
    cityId: full.cityId,
    areaId: full.areaId,
    areaName: row.areaName ?? null,
    type: full.type,
    extraTags: full.extraTags,
    notes: full.notes,
    photoName: full.photoName,
    rating: full.rating,
    googleMapsUrl: full.googleMapsUrl,
    authorAttributions: full.authorAttributions,
  };
}

export async function getPlaceCard(placeId: string): Promise<BrowsePlace | null> {
  await requireAllowedSession();
  return getPlaceCardWithDeps(db, placeId);
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
