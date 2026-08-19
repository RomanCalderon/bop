import { describe, expect, it } from "vitest";
import { user } from "@/db/schema";
import { createTestDb } from "@/test/pglite";
import { insertPlace } from "@/lib/place-insert";
import type { PlaceDetails } from "@/lib/places-types";
import {
  getBrowsePayloadWithDeps,
  listCitiesWithDeps,
  setLastCityWithDeps,
} from "./browse";

function spySql(client: {
  query: (...args: never[]) => unknown;
  exec?: (...args: never[]) => unknown;
}) {
  const sql: string[] = [];
  const originalQuery = client.query.bind(client) as (query: string, ...rest: unknown[]) => unknown;
  client.query = ((query: string, ...rest: unknown[]) => {
    sql.push(query);
    return originalQuery(query, ...rest);
  }) as typeof client.query;
  if (client.exec) {
    const originalExec = client.exec.bind(client) as (query: string, ...rest: unknown[]) => unknown;
    client.exec = ((query: string, ...rest: unknown[]) => {
      sql.push(query);
      return originalExec(query, ...rest);
    }) as typeof client.exec;
  }
  return sql;
}

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

const eastAustin: PlaceDetails = {
  ...austin,
  placeId: "ChIJ-e",
  name: "Cafe",
  addressComponents: [
    { types: ["locality"], longText: "Austin" },
    { types: ["neighborhood"], longText: "East Austin" },
  ],
  primaryType: "cafe",
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

  it("joins area names in one query and does not call toBrowsePlace per place", async () => {
    const { db, client } = await createTestDb();
    await insertPlace(db, { details: austin, notes: "quiet", cityPolicy: { type: "seed" } });
    await insertPlace(db, { details: eastAustin, notes: "", cityPolicy: { type: "seed" } });
    await insertPlace(db, {
      details: { ...austin, placeId: "ChIJ-a2", name: "Records" },
      notes: "",
      cityPolicy: { type: "seed" },
    });

    const sql = spySql(client);
    const payload = await getBrowsePayloadWithDeps(db, "user-1", null);

    expect(payload.places).toHaveLength(3);
    expect(
      payload.places.map((p) => [p.name, p.areaName] as const).sort(([a], [b]) => a.localeCompare(b)),
    ).toEqual([
      ["Books", "Downtown"],
      ["Cafe", "East Austin"],
      ["Records", "Downtown"],
    ]);
    expect(payload.areas.map((a) => a.name).sort()).toEqual(["Downtown", "East Austin"]);

    const areaByIdLookups = sql.filter(
      (s) => /from\s+"?areas"?/i.test(s) && /"?id"?\s*=/i.test(s) && !/"?city_id"?\s*=/i.test(s),
    );
    expect(areaByIdLookups).toEqual([]);
    await client.close();
  });

  it("does not read user_preferences when cityId is provided", async () => {
    const { db, client } = await createTestDb();
    const a = await insertPlace(db, { details: austin, notes: "", cityPolicy: { type: "seed" } });
    const c = await insertPlace(db, { details: chicago, notes: "", cityPolicy: { type: "seed" } });
    expect(a.ok && c.ok).toBe(true);
    if (!a.ok || !c.ok) return;

    const sql = spySql(client);
    const payload = await getBrowsePayloadWithDeps(db, "user-1", c.place.cityId);
    expect(payload.city?.name).toBe("Chicago");
    expect(sql.some((s) => /user_preferences/i.test(s))).toBe(false);
    await client.close();
  });
});

describe("listCitiesWithDeps", () => {
  it("returns city names without querying places", async () => {
    const { db, client } = await createTestDb();
    await insertPlace(db, { details: austin, notes: "", cityPolicy: { type: "seed" } });
    const sql = spySql(client);
    const listed = await listCitiesWithDeps(db);
    expect(listed).toEqual([{ id: expect.any(String), name: "Austin" }]);
    expect(sql.some((s) => /from\s+"?places"?/i.test(s))).toBe(false);
    await client.close();
  });
});
