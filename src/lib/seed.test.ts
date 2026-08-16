import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { places } from "@/db/schema";
import { createTestDb } from "@/test/pglite";
import { insertPlace } from "./place-insert";
import type { PlaceDetails, PlacesPort, TextSearchHit } from "./places-types";
import { seedCollection } from "./seed";

const fixture = readFileSync(
  path.join(process.cwd(), "scripts/fixtures/seed-sample.csv"),
  "utf8",
);

function details(overrides: Partial<PlaceDetails> = {}): PlaceDetails {
  return {
    placeId: "ChIJ-books",
    name: "Slant of Light Books",
    lat: 30.26,
    lng: -97.74,
    formattedAddress: "Austin, TX",
    addressComponents: [
      { types: ["locality"], longText: "Austin" },
      { types: ["neighborhood"], longText: "Downtown" },
    ],
    primaryType: "book_store",
    rating: 4.8,
    googleMapsUri: "https://maps.google.com/?cid=1",
    photoName: "places/ChIJ-books/photos/ABC",
    authorAttributions: [],
    ...overrides,
  };
}

function fakePlaces(impl: {
  textSearch: PlacesPort["textSearch"];
  getDetails: PlacesPort["getDetails"];
}): PlacesPort {
  return {
    autocomplete: async () => [],
    textSearch: impl.textSearch,
    getDetails: impl.getDetails,
    fetchPhoto: async () => null,
  };
}

describe("seedCollection", () => {
  it("buckets resolved, ambiguous, failed, and persists Note only on resolve", async () => {
    const { db, client } = await createTestDb();
    const textSearch = vi.fn(async (query: string): Promise<TextSearchHit[]> => {
      if (query === "Slant of Light Books") {
        return [
          {
            placeId: "ChIJ-books",
            name: "Slant of Light Books",
            formattedAddress: "Austin, TX",
          },
        ];
      }
      if (query === "Common Name") {
        return [
          { placeId: "ChIJ-a", name: "Common A", formattedAddress: "A" },
          { placeId: "ChIJ-b", name: "Common B", formattedAddress: "B" },
        ];
      }
      if (query === "Ghost Pin") return [];
      if (query === "No City Cafe") {
        return [
          {
            placeId: "ChIJ-nocity",
            name: "No City Cafe",
            formattedAddress: "Somewhere",
          },
        ];
      }
      return [];
    });
    const getDetails = vi.fn(async (placeId: string) => {
      if (placeId === "ChIJ-books") return details();
      if (placeId === "ChIJ-nocity") {
        return details({
          placeId,
          name: "No City Cafe",
          addressComponents: [{ types: ["country"], longText: "US" }],
        });
      }
      return null;
    });

    const report = await seedCollection({
      db,
      places: fakePlaces({ textSearch, getDetails }),
      csvText: fixture,
    });

    expect(report.resolved).toHaveLength(1);
    expect(report.resolved[0]?.note).toBe("Quiet used books");
    expect(report.resolved[0]?.reused).toBe(false);
    expect(report.ambiguous).toHaveLength(1);
    expect(report.ambiguous[0]?.candidates).toEqual([
      { placeId: "ChIJ-a", name: "Common A", formattedAddress: "A" },
      { placeId: "ChIJ-b", name: "Common B", formattedAddress: "B" },
    ]);
    expect(report.failed.map((f) => f.reason).sort()).toEqual(
      ["city_inference_failed", "zero_results"].sort(),
    );
    const rows = await db.select().from(places);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.notes).toBe("Quiet used books");
    expect(rows[0]?.seedFeatureCid).toBe("0xaaa:0x111");
    await client.close();
  });

  it("records api_error when Text Search throws after a network failure", async () => {
    const { db, client } = await createTestDb();
    const report = await seedCollection({
      db,
      places: fakePlaces({
        textSearch: async () => {
          throw new Error("places_api_error");
        },
        getDetails: async () => null,
      }),
      csvText: `Note,URL,Tags,Comments\n"",https://www.google.com/maps/place/Ghost+Pin/data=!4m2!3m1!1s0xeee:0x555,,\n`,
    });
    expect(report.failed.map((f) => f.reason)).toEqual(["api_error"]);
    expect(await db.select().from(places)).toHaveLength(0);
    await client.close();
  });

  it("skips Text Search when feature-id/CID is already stored", async () => {
    const { db, client } = await createTestDb();
    await insertPlace(db, {
      details: details(),
      notes: "already",
      seedFeatureCid: "0xaaa:0x111",
      cityPolicy: { type: "seed" },
    });
    const textSearch = vi.fn(async () => []);
    const report = await seedCollection({
      db,
      places: fakePlaces({
        textSearch,
        getDetails: async () => null,
      }),
      csvText: fixture,
    });
    expect(textSearch).not.toHaveBeenCalledWith("Slant of Light Books");
    expect(
      report.resolved.find((r) => r.featureCid === "0xaaa:0x111")?.reused,
    ).toBe(true);
    expect(await db.select().from(places)).toHaveLength(1);
    await client.close();
  });

  it("reuses an existing (place_id, city_id) without a second insert", async () => {
    const { db, client } = await createTestDb();
    await insertPlace(db, {
      details: details(),
      notes: "in-app add",
      cityPolicy: { type: "seed" },
    });
    const textSearch = vi.fn(async (query: string): Promise<TextSearchHit[]> => {
      if (query === "Slant of Light Books") {
        return [
          {
            placeId: "ChIJ-books",
            name: "Slant of Light Books",
            formattedAddress: "Austin, TX",
          },
        ];
      }
      return [];
    });
    const report = await seedCollection({
      db,
      places: fakePlaces({
        textSearch,
        getDetails: async () => details(),
      }),
      csvText: `Note,URL,Tags,Comments\n"",https://www.google.com/maps/place/Slant+of+Light+Books/data=!4m2!3m1!1s0xeee:0x555,,\n`,
    });
    expect(report.resolved[0]?.reused).toBe(true);
    expect(await db.select().from(places)).toHaveLength(1);
    await client.close();
  });
});
