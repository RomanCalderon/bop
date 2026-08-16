import { eq } from "drizzle-orm";
import type { BopDb } from "@/db";
import { areas } from "@/db/schema";
import type { BrowsePlace, PlaceRow } from "@/lib/places-types";

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
