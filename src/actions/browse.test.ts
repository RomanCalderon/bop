import { describe, expect, it } from "vitest";
import { user } from "@/db/schema";
import { createTestDb } from "@/test/pglite";
import { insertPlace } from "@/lib/place-insert";
import type { PlaceDetails } from "@/lib/places-types";
import { getBrowsePayloadWithDeps, setLastCityWithDeps } from "./browse";

const austin: PlaceDetails = {
  placeId: "ChIJ-a",
  name: "Books",
  lat: 30.2,
  lng: -97.7,
  formattedAddress: "Austin, TX",
  addressComponents: [
    { types: ["locality"], longText: "Austin" },
    { types: ["neighborhood"], longText: "Downtown" },
  ],
  primaryType: "book_store",
  rating: 4.5,
  googleMapsUri: "https://maps.google.com/?cid=1",
  photoName: null,
  authorAttributions: [],
};

const chicago: PlaceDetails = {
  ...austin,
  placeId: "ChIJ-c",
  name: "Bar",
  lat: 41.8,
  lng: -87.6,
  formattedAddress: "Chicago, IL",
  addressComponents: [
    { types: ["locality"], longText: "Chicago" },
    { types: ["neighborhood"], longText: "Wicker Park" },
  ],
  primaryType: "bar",
};

describe("getBrowsePayloadWithDeps", () => {
  it("defaults to the city with the most places when no preference is stored", async () => {
    const { db, client } = await createTestDb();
    await insertPlace(db, {
      details: austin,
      notes: "",
      extraTags: ["rainy"],
      cityPolicy: { type: "seed" },
    });
    await insertPlace(db, { details: austin, notes: "", extraTags: ["rainy"], cityPolicy: { type: "seed" } });
    await insertPlace(db, {
      details: { ...austin, placeId: "ChIJ-a2", name: "Cafe" },
      notes: "iced",
      extraTags: ["coffee"],
      cityPolicy: { type: "seed" },
    });
    await insertPlace(db, { details: chicago, notes: "", cityPolicy: { type: "seed" } });

    const payload = await getBrowsePayloadWithDeps(db, "user-1", null);
    expect(payload.city?.name).toBe("Austin");
    expect(payload.places).toHaveLength(2);
    expect(payload.types).toEqual(["book store"]);
    expect(payload.areas.map((a) => a.name)).toEqual(["Downtown"]);
    expect(payload.extraTags.sort()).toEqual(["coffee", "rainy"]);
    expect(payload.cities.map((c) => c.placeCount).sort()).toEqual([1, 2]);
    await client.close();
  });

  it("uses last_city_id when set", async () => {
    const { db, client } = await createTestDb();
    const a = await insertPlace(db, { details: austin, notes: "", cityPolicy: { type: "seed" } });
    const c = await insertPlace(db, { details: chicago, notes: "", cityPolicy: { type: "seed" } });
    expect(a.ok && c.ok).toBe(true);
    if (!a.ok || !c.ok) return;
    await db.insert(user).values({
      id: "user-1",
      name: "Ada",
      email: "ada@x.com",
    });
    await setLastCityWithDeps(db, "user-1", c.place.cityId);
    const payload = await getBrowsePayloadWithDeps(db, "user-1", null);
    expect(payload.city?.name).toBe("Chicago");
    await client.close();
  });

  it("returns an empty payload when there are no cities", async () => {
    const { db, client } = await createTestDb();
    const payload = await getBrowsePayloadWithDeps(db, "user-1", null);
    expect(payload.city).toBeNull();
    expect(payload.places).toEqual([]);
    await client.close();
  });
});
