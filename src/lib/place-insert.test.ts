import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { cities, places } from "@/db/schema";
import { createTestDb } from "@/test/pglite";
import { insertPlace } from "./place-insert";
import type { PlaceDetails } from "./places-types";

function details(overrides: Partial<PlaceDetails> = {}): PlaceDetails {
  return {
    placeId: "ChIJ-books",
    name: "Slant of Light Books",
    lat: 30.267,
    lng: -97.743,
    formattedAddress: "123 E 7th St, Austin, TX",
    addressComponents: [
      { types: ["locality"], longText: "Austin" },
      { types: ["neighborhood"], longText: "Downtown" },
    ],
    primaryType: "book_store",
    rating: 4.8,
    googleMapsUri: "https://maps.google.com/?cid=1",
    photoName: "places/ChIJ-books/photos/ABC",
    authorAttributions: [{ displayName: "Ada", uri: null }],
    ...overrides,
  };
}

describe("insertPlace", () => {
  it("creates a city and area from Place Details", async () => {
    const { db, client } = await createTestDb();
    const result = await insertPlace(db, {
      details: details(),
      notes: "Best used books",
      cityPolicy: { type: "seed" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(true);
    expect(result.place.cityId).toBeTruthy();
    expect(result.place.areaId).toBeTruthy();
    expect(result.place.type).toBe("book store");
    expect(result.place.notes).toBe("Best used books");
    const cityRows = await db.select().from(cities);
    expect(cityRows[0]?.name).toBe("Austin");
    await client.close();
  });

  it("reuses an existing city matched case-insensitively", async () => {
    const { db, client } = await createTestDb();
    await db.insert(cities).values({ id: "c-austin", name: "austin" });
    const result = await insertPlace(db, {
      details: details(),
      notes: "",
      cityPolicy: { type: "seed" },
    });
    expect(result.ok && result.place.cityId).toBe("c-austin");
    const cityRows = await db.select().from(cities);
    expect(cityRows).toHaveLength(1);
    await client.close();
  });

  it("returns the existing row when place_id already exists in the inferred city", async () => {
    const { db, client } = await createTestDb();
    const first = await insertPlace(db, {
      details: details(),
      notes: "first",
      cityPolicy: { type: "seed" },
    });
    const second = await insertPlace(db, {
      details: details(),
      notes: "second",
      cityPolicy: { type: "seed" },
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.created).toBe(false);
    expect(second.place.id).toBe(first.place.id);
    expect(second.place.notes).toBe("first");
    const rows = await db.select().from(places);
    expect(rows).toHaveLength(1);
    await client.close();
  });

  it("falls back to the current city for in-app when inference misses", async () => {
    const { db, client } = await createTestDb();
    await db.insert(cities).values({ id: "viewed", name: "Chicago" });
    const result = await insertPlace(db, {
      details: details({
        addressComponents: [{ types: ["country"], longText: "US" }],
      }),
      notes: "",
      cityPolicy: { type: "in-app", currentCityId: "viewed" },
    });
    expect(result.ok && result.place.cityId).toBe("viewed");
    await client.close();
  });

  it("fails seed insert when city inference misses", async () => {
    const { db, client } = await createTestDb();
    const result = await insertPlace(db, {
      details: details({
        addressComponents: [{ types: ["country"], longText: "US" }],
      }),
      notes: "",
      cityPolicy: { type: "seed" },
    });
    expect(result).toEqual({ ok: false, reason: "city_inference_failed" });
    expect(await db.select().from(places)).toHaveLength(0);
    await client.close();
  });

  it("inserts with a null area when no area component exists", async () => {
    const { db, client } = await createTestDb();
    const result = await insertPlace(db, {
      details: details({
        addressComponents: [{ types: ["locality"], longText: "Austin" }],
      }),
      notes: "",
      cityPolicy: { type: "seed" },
    });
    expect(result.ok && result.place.areaId).toBeNull();
    await client.close();
  });

  it("returns the existing row when seed_feature_cid is already stored", async () => {
    const { db, client } = await createTestDb();
    const first = await insertPlace(db, {
      details: details(),
      notes: "one",
      seedFeatureCid: "0xaaa:0xbbb",
      cityPolicy: { type: "seed" },
    });
    const second = await insertPlace(db, {
      details: details({ placeId: "ChIJ-other", name: "Other" }),
      notes: "two",
      seedFeatureCid: "0xaaa:0xbbb",
      cityPolicy: { type: "seed" },
    });
    expect(first.ok && second.ok && !second.created).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.place.id).toBe(first.place.id);
    expect(await db.select().from(places).where(eq(places.seedFeatureCid, "0xaaa:0xbbb"))).toHaveLength(1);
    await client.close();
  });
});
