import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { allowedEmails, areas, cities, places } from "./schema";
import { createTestDb } from "@/test/pglite";

describe("schema constraints", () => {
  it("rejects a second place with the same place_id in the same city", async () => {
    const { db, client } = await createTestDb();
    const [city] = await db
      .insert(cities)
      .values({ id: "city-1", name: "Austin" })
      .returning();

    await db.insert(places).values({
      id: "p1",
      placeId: "ChIJ1",
      name: "One",
      lat: 30.2,
      lng: -97.7,
      formattedAddress: "Austin, TX",
      cityId: city.id,
    });

    await expect(
      db.insert(places).values({
        id: "p2",
        placeId: "ChIJ1",
        name: "Two",
        lat: 30.2,
        lng: -97.7,
        formattedAddress: "Austin, TX",
        cityId: city.id,
      }),
    ).rejects.toThrow();

    await client.close();
  });

  it("allows the same place_id in two cities", async () => {
    const { db, client } = await createTestDb();
    await db.insert(cities).values([
      { id: "c1", name: "Austin" },
      { id: "c2", name: "Chicago" },
    ]);
    await db.insert(places).values([
      {
        id: "p1",
        placeId: "ChIJ1",
        name: "One",
        lat: 30.2,
        lng: -97.7,
        formattedAddress: "Austin",
        cityId: "c1",
      },
      {
        id: "p2",
        placeId: "ChIJ1",
        name: "One",
        lat: 41.8,
        lng: -87.6,
        formattedAddress: "Chicago",
        cityId: "c2",
      },
    ]);
    const rows = await db.select().from(places).where(eq(places.placeId, "ChIJ1"));
    expect(rows).toHaveLength(2);
    await client.close();
  });

  it("rejects a duplicate non-null seed_feature_cid", async () => {
    const { db, client } = await createTestDb();
    await db.insert(cities).values({ id: "c1", name: "Austin" });
    await db.insert(places).values({
      id: "p1",
      placeId: "ChIJ1",
      name: "One",
      lat: 30.2,
      lng: -97.7,
      formattedAddress: "Austin",
      cityId: "c1",
      seedFeatureCid: "0xaaa:0xbbb",
    });
    await expect(
      db.insert(places).values({
        id: "p2",
        placeId: "ChIJ2",
        name: "Two",
        lat: 30.2,
        lng: -97.7,
        formattedAddress: "Austin",
        cityId: "c1",
        seedFeatureCid: "0xaaa:0xbbb",
      }),
    ).rejects.toThrow();
    await client.close();
  });

  it("rejects a second area with the same name in a city ignoring case", async () => {
    const { db, client } = await createTestDb();
    await db.insert(cities).values({ id: "c1", name: "Austin" });
    await db.insert(areas).values({
      id: "a1",
      cityId: "c1",
      name: "East Austin",
    });
    await expect(
      db.insert(areas).values({
        id: "a2",
        cityId: "c1",
        name: "east austin",
      }),
    ).rejects.toThrow();
    await client.close();
  });

  it("stores allowed emails uniquely", async () => {
    const { db, client } = await createTestDb();
    await db.insert(allowedEmails).values({
      id: "e1",
      email: "ada@example.com",
    });
    await expect(
      db.insert(allowedEmails).values({
        id: "e2",
        email: "ada@example.com",
      }),
    ).rejects.toThrow();
    await client.close();
  });
});
