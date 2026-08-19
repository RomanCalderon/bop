import { describe, expect, it } from "vitest";
import { createTestDb } from "@/test/pglite";
import { addPlaceWithDeps, searchPlacesWithDeps } from "./places";
import type { PlaceDetails, PlacesPort } from "@/lib/places-types";

const details: PlaceDetails = {
  placeId: "ChIJ1",
  name: "Books",
  lat: 30.2,
  lng: -97.7,
  formattedAddress: "Austin, TX",
  addressComponents: [{ types: ["locality"], longText: "Austin" }],
  primaryType: "book_store",
  rating: 4.5,
  googleMapsUri: "https://maps.google.com/?cid=1",
  photoName: "places/ChIJ1/photos/AAA",
  authorAttributions: [{ displayName: "Ada", uri: null }],
};

const placesPort: PlacesPort = {
  autocomplete: async () => [],
  textSearch: async () => [],
  getDetails: async () => details,
  fetchPhoto: async () => null,
};

describe("searchPlacesWithDeps", () => {
  it("returns the find-that copy when Autocomplete is empty", async () => {
    const result = await searchPlacesWithDeps(placesPort, "zzz");
    expect(result).toEqual({
      ok: false,
      message: "Couldn't find that — try a more specific name.",
    });
  });

  it("returns suggestions when Autocomplete has hits", async () => {
    const suggestion = {
      placeId: "ChIJ1",
      primaryText: "Books",
      secondaryText: "Austin, TX",
    };
    const result = await searchPlacesWithDeps(
      { ...placesPort, autocomplete: async () => [suggestion] },
      "books",
    );
    expect(result).toEqual({ ok: true, suggestions: [suggestion] });
  });
});

describe("addPlaceWithDeps", () => {
  it("persists a row from mocked details", async () => {
    const { db, client } = await createTestDb();
    const result = await addPlaceWithDeps({
      db,
      places: placesPort,
      placeId: "ChIJ1",
      currentCityId: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(true);
    expect(result.place.name).toBe("Books");
    await client.close();
  });

  it("opens the existing row on duplicate place_id in the same city", async () => {
    const { db, client } = await createTestDb();
    const first = await addPlaceWithDeps({
      db,
      places: placesPort,
      placeId: "ChIJ1",
      currentCityId: null,
    });
    const second = await addPlaceWithDeps({
      db,
      places: placesPort,
      placeId: "ChIJ1",
      currentCityId: first.ok ? first.place.cityId : null,
    });
    expect(first.ok && second.ok && !second.created).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.place.id).toBe(first.place.id);
    await client.close();
  });

  it("does not insert when details are missing", async () => {
    const { db, client } = await createTestDb();
    const result = await addPlaceWithDeps({
      db,
      places: { ...placesPort, getDetails: async () => null },
      placeId: "ChIJ1",
      currentCityId: "city-1",
    });
    expect(result).toEqual({
      ok: false,
      message: "Couldn't save, try again.",
    });
    await client.close();
  });
});
