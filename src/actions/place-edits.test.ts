import { describe, expect, it } from "vitest";
import { createTestDb } from "@/test/pglite";
import { insertPlace } from "@/lib/place-insert";
import type { PlaceDetails } from "@/lib/places-types";
import { movePlaceWithDeps, updatePlaceWithDeps } from "./places";

const details = (city: string, placeId: string): PlaceDetails => ({
  placeId,
  name: "Spot",
  lat: 30,
  lng: -97,
  formattedAddress: city,
  addressComponents: [{ types: ["locality"], longText: city }],
  primaryType: "bar",
  rating: null,
  googleMapsUri: "https://maps.google.com/?cid=1",
  photoName: null,
  authorAttributions: [],
});

describe("place edits", () => {
  it("updates notes last-write-wins and leaves photo fields alone", async () => {
    const { db, client } = await createTestDb();
    const created = await insertPlace(db, {
      details: {
        ...details("Austin", "ChIJ1"),
        photoName: "places/ChIJ1/photos/AAA",
        rating: 4.2,
      },
      notes: "old",
      cityPolicy: { type: "seed" },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const updated = await updatePlaceWithDeps(db, created.place.id, {
      notes: "new",
    });
    expect(updated.ok && updated.place.notes).toBe("new");
    if (!updated.ok) return;
    expect(updated.place.photoName).toBe("places/ChIJ1/photos/AAA");
    expect(updated.place.rating).toBe(4.2);
    await client.close();
  });

  it("blocks a move when the place_id already exists in the target city", async () => {
    const { db, client } = await createTestDb();
    const austin = await insertPlace(db, {
      details: details("Austin", "ChIJ1"),
      notes: "",
      cityPolicy: { type: "seed" },
    });
    const chicago = await insertPlace(db, {
      details: details("Chicago", "ChIJ1"),
      notes: "",
      cityPolicy: { type: "seed" },
    });
    expect(austin.ok && chicago.ok).toBe(true);
    if (!austin.ok || !chicago.ok) return;
    const moved = await movePlaceWithDeps(db, austin.place.id, chicago.place.cityId);
    expect(moved.ok).toBe(false);
    if (moved.ok) return;
    expect(moved.existingPlaceId).toBe(chicago.place.id);
    await client.close();
  });
});
