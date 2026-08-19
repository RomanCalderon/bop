> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 10: Places client, add action, photo route

**Files:**
- Modify: `src/lib/places.ts` (replace the Task 8 stub)
- Create: `src/lib/places.test.ts`
- Create: `src/actions/places.ts`
- Create: `src/actions/places.test.ts`
- Create: `src/app/api/photos/route.ts`
- Create: `src/app/api/photos/route.test.ts`

**Interfaces:**
- Consumes: `PlacesPort`, `PlaceDetails`, `AutocompleteSuggestion`, `BrowsePlace` from `src/lib/places-types.ts`; `insertPlace`; `requireAllowedSession` / `getAllowedSession`; `createTestDb`
- Produces: `createPlacesClient(apiKey)`; `searchPlaces`; `addPlace`; `GET /api/photos?name=`

Use Places API (New) only:

- Autocomplete: `POST https://places.googleapis.com/v1/places:autocomplete`
- Text Search: `POST https://places.googleapis.com/v1/places:searchText`
- Details: `GET https://places.googleapis.com/v1/places/{placeId}`
- Photo: `GET https://places.googleapis.com/v1/{photoName}/media?maxHeightPx=800&skipHttpRedirect=true`

Field masks:

- Autocomplete: `suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat`
- Text Search: `places.id,places.displayName,places.formattedAddress`
- Details: `id,displayName,location,formattedAddress,addressComponents,primaryType,rating,googleMapsUri,photos`

Map `addressComponents[].longText` (or `long_name` if a fixture uses the old key — prefer `longText`). Store `photos[0].name` as `photoName` and `photos[0].authorAttributions`.

- [ ] **Step 1: Write the failing tests**

`src/lib/places.test.ts`:

```ts
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
```

`src/actions/places.test.ts` — do not import the `"use server"` module if that complicates Vitest. Extract `addPlaceWithDeps` in `src/actions/places.ts` and test that.

```ts
import { describe, expect, it } from "vitest";
import { createTestDb } from "@/test/pglite";
import { addPlaceWithDeps } from "./places";
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
```

`src/app/api/photos/route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/session", () => ({
  getAllowedSession: vi.fn(),
}));

vi.mock("@/lib/places", () => ({
  createPlacesClient: () => ({
    fetchPhoto: async () => ({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    }),
  }),
}));

import { getAllowedSession } from "@/lib/session";

describe("GET /api/photos", () => {
  it("returns 401 without a session", async () => {
    vi.mocked(getAllowedSession).mockResolvedValue({
      ok: false,
      reason: "unauthenticated",
    });
    const res = await GET(
      new Request("http://localhost/api/photos?name=places/x/photos/y"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a signed-in email that is not invited", async () => {
    vi.mocked(getAllowedSession).mockResolvedValue({
      ok: false,
      reason: "not_invited",
    });
    const res = await GET(
      new Request("http://localhost/api/photos?name=places/x/photos/y"),
    );
    expect(res.status).toBe(403);
  });

  it("returns bytes for an allowlisted session", async () => {
    vi.mocked(getAllowedSession).mockResolvedValue({
      ok: true,
      user: { id: "u1", email: "ada@x.com", name: "Ada" },
    });
    const res = await GET(
      new Request("http://localhost/api/photos?name=places/x/photos/y"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/places.test.ts src/actions/places.test.ts src/app/api/photos/route.test.ts`
Expected: FAIL — implementations missing or stub throws.

- [ ] **Step 3: Write the client, actions, and route**

`src/lib/places.ts`:

```ts
import type {
  AutocompleteSuggestion,
  PlaceDetails,
  PlacesPort,
  PhotoAttribution,
  TextSearchHit,
} from "./places-types";

const AUTOCOMPLETE_MASK =
  "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat";
const TEXT_MASK = "places.id,places.displayName,places.formattedAddress";
const DETAILS_MASK =
  "id,displayName,location,formattedAddress,addressComponents,primaryType,rating,googleMapsUri,photos";

function attributions(
  raw: { displayName?: string; uri?: string }[] | undefined,
): PhotoAttribution[] {
  return (raw ?? []).map((a) => ({
    displayName: a.displayName ?? "",
    uri: a.uri ? a.uri : null,
  }));
}

async function googleFetch(
  url: string,
  init: RequestInit,
  retries = 1,
): Promise<Response | null> {
  try {
    const res = await fetch(url, init);
    if (res.ok) return res;
    if (retries > 0) return googleFetch(url, init, retries - 1);
    return null;
  } catch {
    if (retries > 0) return googleFetch(url, init, retries - 1);
    return null;
  }
}

export function createPlacesClient(apiKey: string): PlacesPort {
  const headers = (mask: string) => ({
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
    "X-Goog-FieldMask": mask,
  });

  return {
    async autocomplete(input: string): Promise<AutocompleteSuggestion[]> {
      const res = await googleFetch(
        "https://places.googleapis.com/v1/places:autocomplete",
        {
          method: "POST",
          headers: headers(AUTOCOMPLETE_MASK),
          body: JSON.stringify({ input }),
        },
      );
      if (!res) return [];
      const json = (await res.json()) as {
        suggestions?: {
          placePrediction?: {
            placeId?: string;
            structuredFormat?: {
              mainText?: { text?: string };
              secondaryText?: { text?: string };
            };
          };
        }[];
      };
      return (json.suggestions ?? [])
        .map((s) => s.placePrediction)
        .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
        .map((p) => ({
          placeId: p.placeId!,
          primaryText: p.structuredFormat?.mainText?.text ?? "",
          secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
        }));
    },

    async textSearch(query: string): Promise<TextSearchHit[]> {
      const res = await googleFetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: headers(TEXT_MASK),
          body: JSON.stringify({ textQuery: query }),
        },
      );
      if (!res) return [];
      const json = (await res.json()) as {
        places?: {
          id?: string;
          displayName?: { text?: string };
          formattedAddress?: string;
        }[];
      };
      return (json.places ?? [])
        .filter((p) => p.id)
        .map((p) => ({
          placeId: p.id!,
          name: p.displayName?.text ?? "",
          formattedAddress: p.formattedAddress ?? "",
        }));
    },

    async getDetails(placeId: string): Promise<PlaceDetails | null> {
      const res = await googleFetch(
        `https://places.googleapis.com/v1/places/${placeId}`,
        { headers: headers(DETAILS_MASK) },
      );
      if (!res) return null;
      const json = (await res.json()) as {
        id?: string;
        displayName?: { text?: string };
        location?: { latitude?: number; longitude?: number };
        formattedAddress?: string;
        addressComponents?: { longText?: string; types?: string[] }[];
        primaryType?: string;
        rating?: number;
        googleMapsUri?: string;
        photos?: {
          name?: string;
          authorAttributions?: { displayName?: string; uri?: string }[];
        }[];
      };
      if (!json.id || json.location?.latitude == null || json.location.longitude == null) {
        return null;
      }
      const photo = json.photos?.[0];
      return {
        placeId: json.id,
        name: json.displayName?.text ?? "",
        lat: json.location.latitude,
        lng: json.location.longitude,
        formattedAddress: json.formattedAddress ?? "",
        addressComponents: (json.addressComponents ?? []).map((c) => ({
          types: c.types ?? [],
          longText: c.longText ?? "",
        })),
        primaryType: json.primaryType ?? null,
        rating: json.rating ?? null,
        googleMapsUri: json.googleMapsUri ?? "",
        photoName: photo?.name ?? null,
        authorAttributions: attributions(photo?.authorAttributions),
      };
    },

    async fetchPhoto(photoName: string) {
      const res = await googleFetch(
        `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=800&skipHttpRedirect=true`,
        { headers: { "X-Goog-Api-Key": apiKey } },
      );
      if (!res) return null;
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const json = (await res.json()) as { photoUri?: string };
        if (!json.photoUri) return null;
        const img = await fetch(json.photoUri);
        if (!img.ok) return null;
        return {
          bytes: new Uint8Array(await img.arrayBuffer()),
          contentType: img.headers.get("content-type") ?? "image/jpeg",
        };
      }
      return {
        bytes: new Uint8Array(await res.arrayBuffer()),
        contentType: contentType || "image/jpeg",
      };
    },
  };
}
```

`src/actions/places.ts`:

```ts
"use server";

import { db } from "@/db";
import type { BopDb } from "@/db";
import { insertPlace } from "@/lib/place-insert";
import { createPlacesClient } from "@/lib/places";
import type { BrowsePlace, PlacesPort } from "@/lib/places-types";
import { requireAllowedSession } from "@/lib/require-allowed";
import { toBrowsePlace } from "@/actions/place-view";

export async function addPlaceWithDeps(opts: {
  db: BopDb;
  places: PlacesPort;
  placeId: string;
  currentCityId: string | null;
}): Promise<
  | { ok: true; place: BrowsePlace; created: boolean }
  | { ok: false; message: string }
> {
  const details = await opts.places.getDetails(opts.placeId);
  if (!details) return { ok: false, message: "Couldn't save, try again." };
  const cityPolicy =
    opts.currentCityId === null
      ? ({ type: "seed" } as const)
      : ({ type: "in-app", currentCityId: opts.currentCityId } as const);
  const result = await insertPlace(opts.db, {
    details,
    notes: "",
    cityPolicy:
      opts.currentCityId === null && !details.addressComponents.length
        ? { type: "seed" }
        : cityPolicy,
  });
  if (!result.ok) return { ok: false, message: "Couldn't save, try again." };
  return {
    ok: true,
    place: await toBrowsePlace(opts.db, result.place),
    created: result.created,
  };
}
```

Fix the city-policy logic so it matches the spec exactly:

```ts
  const inferredMissing =
    !details.addressComponents.some((c) =>
      c.types.includes("locality") ||
      c.types.includes("administrative_area_level_1"),
    );
  if (inferredMissing && opts.currentCityId === null) {
    return { ok: false, message: "Couldn't save, try again." };
  }
  const result = await insertPlace(opts.db, {
    details,
    notes: "",
    cityPolicy:
      opts.currentCityId === null
        ? { type: "seed" }
        : { type: "in-app", currentCityId: opts.currentCityId },
  });
```

When `currentCityId` is null and inference succeeds, `{ type: "seed" }` still creates the inferred city — that is correct for the first place in an empty app.

`searchPlaces` and `addPlace` wrap `requireAllowedSession` and `createPlacesClient(process.env.GOOGLE_PLACES_SERVER_KEY ?? "")`. Autocomplete failure message: `"Couldn't find that — try a more specific name."`

`toBrowsePlace` will be created in Task 11. For this task, add a local helper in `src/actions/place-view.ts` so Task 10 does not depend on Task 11:

```ts
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
```

Import `toBrowsePlace` from `@/actions/place-view` in this task. Task 11 will re-export or use the same helper — do not rename it.

`src/app/api/photos/route.ts`:

```ts
import { createPlacesClient } from "@/lib/places";
import { getAllowedSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getAllowedSession();
  if (!session.ok) {
    return new Response("Forbidden", {
      status: session.reason === "unauthenticated" ? 401 : 403,
    });
  }
  const name = new URL(request.url).searchParams.get("name");
  if (!name || !name.startsWith("places/")) {
    return new Response("Bad request", { status: 400 });
  }
  const photo = await createPlacesClient(
    process.env.GOOGLE_PLACES_SERVER_KEY ?? "",
  ).fetchPhoto(name);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(photo.bytes, {
    headers: {
      "content-type": photo.contentType,
      "cache-control": "private, max-age=86400",
    },
  });
}
```

Also export `updatePlace`, `deletePlace`, and `movePlace` from `src/actions/places.ts` in Task 11 — not this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/places.test.ts src/actions/places.test.ts src/app/api/photos/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Add Places API client, add-place action, and photo proxy

* Call Places API (New) on the server with one retry
* Persist add through insertPlace and gate photos on an allowlisted session
EOF
git add src/lib/places.ts src/lib/places.test.ts src/actions/places.ts src/actions/places.test.ts src/actions/place-view.ts src/app/api/photos/route.ts src/app/api/photos/route.test.ts
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
