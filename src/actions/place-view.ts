import { eq } from "drizzle-orm";
import type { BopDb } from "@/db";
import { areas, places } from "@/db/schema";
import type { BrowsePlace, PlaceRow } from "@/lib/places-types";

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

export async function toBrowsePlace(
  db: BopDb,
  place: PlaceRow,
): Promise<BrowsePlace> {
  if (!place.areaId) return { ...place, areaName: null };
  const [area] = await db
    .select()
    .from(areas)
    .where(eq(areas.id, place.areaId))
    .limit(1);
  return { ...place, areaName: area?.name ?? null };
}
