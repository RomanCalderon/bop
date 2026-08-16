"use server";

import { asc, count, eq } from "drizzle-orm";
import { db, type BopDb } from "@/db";
import { areas, cities, places, userPreferences } from "@/db/schema";
import { toBrowsePlace } from "@/actions/place-view";
import type { BrowsePayload, PlaceRow } from "@/lib/places-types";
import { requireAllowedSession } from "@/lib/require-allowed";

export function toPlaceRow(row: typeof places.$inferSelect): PlaceRow {
  return {
    id: row.id,
    placeId: row.placeId,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    formattedAddress: row.formattedAddress,
    cityId: row.cityId,
    areaId: row.areaId,
    type: row.type,
    extraTags: row.extraTags,
    notes: row.notes,
    rating: row.rating,
    googleMapsUrl: row.googleMapsUrl,
    photoName: row.photoName,
    authorAttributions: row.authorAttributions,
    seedFeatureCid: row.seedFeatureCid,
  };
}

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

  const pref = await database
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  const requested =
    (cityId && cityRows.find((c) => c.id === cityId)) ||
    (pref[0]?.lastCityId &&
      cityRows.find((c) => c.id === pref[0].lastCityId)) ||
    [...cityRows].sort((a, b) => {
      const byCount = Number(b.placeCount) - Number(a.placeCount);
      return byCount !== 0 ? byCount : a.name.localeCompare(b.name);
    })[0] ||
    null;

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

  const placeRows = await database
    .select()
    .from(places)
    .where(eq(places.cityId, requested.id));
  const areaRows = await database
    .select()
    .from(areas)
    .where(eq(areas.cityId, requested.id));
  const browsePlaces = await Promise.all(
    placeRows.map((row) => toBrowsePlace(database, toPlaceRow(row))),
  );
  const types = [...new Set(browsePlaces.map((p) => p.type).filter((t): t is string => Boolean(t)))].sort();
  const extraTags = [...new Set(browsePlaces.flatMap((p) => p.extraTags))].sort();

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
    areas: areaRows.map((a) => ({ id: a.id, name: a.name })),
    extraTags,
  };
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
