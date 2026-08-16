import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlacesClient } from "./places";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createPlacesClient", () => {
  it("maps Autocomplete (New) suggestions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            suggestions: [
              {
                placePrediction: {
                  placeId: "ChIJ1",
                  structuredFormat: {
                    mainText: { text: "Slant of Light Books" },
                    secondaryText: { text: "Austin, TX" },
                  },
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const client = createPlacesClient("test-key");
    await expect(client.autocomplete("slant")).resolves.toEqual([
      {
        placeId: "ChIJ1",
        primaryText: "Slant of Light Books",
        secondaryText: "Austin, TX",
      },
    ]);
  });

  it("retries Text Search once, then returns hits", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            places: [
              {
                id: "ChIJ1",
                displayName: { text: "Books" },
                formattedAddress: "Austin",
              },
            ],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const hits = await createPlacesClient("k").textSearch("Books");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(hits).toEqual([
      { placeId: "ChIJ1", name: "Books", formattedAddress: "Austin" },
    ]);
  });

  it("throws after retry when Text Search keeps failing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 500 }))
      .mockResolvedValueOnce(new Response("nope", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(createPlacesClient("k").textSearch("Books")).rejects.toThrow(
      "places_api_error",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns an empty list when Autocomplete has zero hits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ suggestions: [] }), { status: 200 }),
      ),
    );
    await expect(createPlacesClient("k").autocomplete("zzz")).resolves.toEqual(
      [],
    );
  });

  it("maps Place Details including photo resource name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: "ChIJ1",
            displayName: { text: "Books" },
            location: { latitude: 30.2, longitude: -97.7 },
            formattedAddress: "Austin, TX",
            addressComponents: [
              { longText: "Austin", types: ["locality"] },
            ],
            primaryType: "book_store",
            rating: 4.5,
            googleMapsUri: "https://maps.google.com/?cid=1",
            photos: [
              {
                name: "places/ChIJ1/photos/AAA",
                authorAttributions: [{ displayName: "Ada", uri: "" }],
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const details = await createPlacesClient("k").getDetails("ChIJ1");
    expect(details?.photoName).toBe("places/ChIJ1/photos/AAA");
    expect(details?.authorAttributions).toEqual([
      { displayName: "Ada", uri: null },
    ]);
    expect(details?.primaryType).toBe("book_store");
  });
});
