import { and, eq, sql } from "drizzle-orm";
import type { BopDb } from "@/db";
import { areas, cities, places } from "@/db/schema";
import { displayType, inferAreaName, inferCityName } from "./infer-location";
import type {
  InsertPlaceInput,
  InsertPlaceResult,
  PlaceRow,
} from "./places-types";

function toRow(row: typeof places.$inferSelect): PlaceRow {
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

async function findOrCreateCity(
  db: BopDb,
  name: string,
  lat: number,
  lng: number,
): Promise<string> {
  const existing = await db
    .select()
    .from(cities)
    .where(sql`lower(${cities.name}) = ${name.toLowerCase()}`)
    .limit(1);
  if (existing[0]) return existing[0].id;
  const id = crypto.randomUUID();
  await db.insert(cities).values({
    id,
    name,
    centerLat: lat,
    centerLng: lng,
  });
  return id;
}

async function findOrCreateArea(
  db: BopDb,
  cityId: string,
  name: string,
): Promise<string> {
  const existing = await db
    .select()
    .from(areas)
    .where(
      and(eq(areas.cityId, cityId), sql`lower(${areas.name}) = ${name.toLowerCase()}`),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;
  const id = crypto.randomUUID();
  await db.insert(areas).values({ id, cityId, name });
  return id;
}

export async function insertPlace(
  db: BopDb,
  input: InsertPlaceInput,
): Promise<InsertPlaceResult> {
  if (input.seedFeatureCid) {
    const byCid = await db
      .select()
      .from(places)
      .where(eq(places.seedFeatureCid, input.seedFeatureCid))
      .limit(1);
    if (byCid[0]) return { ok: true, place: toRow(byCid[0]), created: false };
  }

  const inferredCity = inferCityName(input.details.addressComponents);
  let cityId: string;
  if (inferredCity) {
    cityId = await findOrCreateCity(
      db,
      inferredCity,
      input.details.lat,
      input.details.lng,
    );
  } else if (input.cityPolicy.type === "in-app") {
    cityId = input.cityPolicy.currentCityId;
  } else {
    return { ok: false, reason: "city_inference_failed" };
  }

  const inferredArea = inferAreaName(input.details.addressComponents);
  const areaId = inferredArea
    ? await findOrCreateArea(db, cityId, inferredArea)
    : null;

  const existing = await db
    .select()
    .from(places)
    .where(
      and(
        eq(places.placeId, input.details.placeId),
        eq(places.cityId, cityId),
      ),
    )
    .limit(1);
  if (existing[0]) return { ok: true, place: toRow(existing[0]), created: false };

  const row = {
    id: crypto.randomUUID(),
    placeId: input.details.placeId,
    name: input.details.name,
    lat: input.details.lat,
    lng: input.details.lng,
    formattedAddress: input.details.formattedAddress,
    cityId,
    areaId,
    type: displayType(input.details.primaryType),
    extraTags: input.extraTags ?? [],
    notes: input.notes,
    rating: input.details.rating,
    googleMapsUrl: input.details.googleMapsUri,
    photoName: input.details.photoName,
    authorAttributions: input.details.authorAttributions,
    seedFeatureCid: input.seedFeatureCid ?? null,
  };

  await db.insert(places).values(row);
  return { ok: true, place: row, created: true };
}
