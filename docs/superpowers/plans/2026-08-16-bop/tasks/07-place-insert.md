> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 7: Shared place insert path

**Files:**
- Create: `src/lib/place-insert.ts`
- Create: `src/lib/place-insert.test.ts`

**Interfaces:**
- Consumes: `BopDb` from `src/db/index.ts`; `createTestDb` from `src/test/pglite.ts`; `inferCityName`, `inferAreaName`, `displayType` from `src/lib/infer-location.ts`; `InsertPlaceInput`, `InsertPlaceResult`, `PlaceDetails`, `PlaceRow` from `src/lib/places-types.ts`
- Produces: `insertPlace(db, input)` as specified in overview.md

- [ ] **Step 1: Write the failing tests**

Create `src/lib/place-insert.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/place-insert.test.ts`
Expected: FAIL — `insertPlace` is not a function.

- [ ] **Step 3: Write minimal implementation**

`src/lib/place-insert.ts`:

```ts
import { and, eq, sql } from "drizzle-orm";
import type { BopDb } from "@/db";
import { areas, cities, places } from "@/db/schema";
import { displayType, inferAreaName, inferCityName } from "./infer-location";
import type {
  InsertPlaceInput,
  InsertPlaceResult,
  PlaceRow,
} from "./places-types";

function toRow(row: typeof places.$inferSelect): PlaceRow {
  return {
    id: row.id,
    placeId: row.placeId,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    formattedAddress: row.formattedAddress,
    cityId: row.cityId,
    areaId: row.areaId,
    type: row.type,
    extraTags: row.extraTags,
    notes: row.notes,
    rating: row.rating,
    googleMapsUrl: row.googleMapsUrl,
    photoName: row.photoName,
    authorAttributions: row.authorAttributions,
    seedFeatureCid: row.seedFeatureCid,
  };
}

async function findOrCreateCity(
  db: BopDb,
  name: string,
  lat: number,
  lng: number,
): Promise<string> {
  const existing = await db
    .select()
    .from(cities)
    .where(sql`lower(${cities.name}) = ${name.toLowerCase()}`)
    .limit(1);
  if (existing[0]) return existing[0].id;
  const id = crypto.randomUUID();
  await db.insert(cities).values({
    id,
    name,
    centerLat: lat,
    centerLng: lng,
  });
  return id;
}

async function findOrCreateArea(
  db: BopDb,
  cityId: string,
  name: string,
): Promise<string> {
  const existing = await db
    .select()
    .from(areas)
    .where(
      and(eq(areas.cityId, cityId), sql`lower(${areas.name}) = ${name.toLowerCase()}`),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;
  const id = crypto.randomUUID();
  await db.insert(areas).values({ id, cityId, name });
  return id;
}

export async function insertPlace(
  db: BopDb,
  input: InsertPlaceInput,
): Promise<InsertPlaceResult> {
  if (input.seedFeatureCid) {
    const byCid = await db
      .select()
      .from(places)
      .where(eq(places.seedFeatureCid, input.seedFeatureCid))
      .limit(1);
    if (byCid[0]) return { ok: true, place: toRow(byCid[0]), created: false };
  }

  const inferredCity = inferCityName(input.details.addressComponents);
  let cityId: string;
  if (inferredCity) {
    cityId = await findOrCreateCity(
      db,
      inferredCity,
      input.details.lat,
      input.details.lng,
    );
  } else if (input.cityPolicy.type === "in-app") {
    cityId = input.cityPolicy.currentCityId;
  } else {
    return { ok: false, reason: "city_inference_failed" };
  }

  const inferredArea = inferAreaName(input.details.addressComponents);
  const areaId = inferredArea
    ? await findOrCreateArea(db, cityId, inferredArea)
    : null;

  const existing = await db
    .select()
    .from(places)
    .where(
      and(
        eq(places.placeId, input.details.placeId),
        eq(places.cityId, cityId),
      ),
    )
    .limit(1);
  if (existing[0]) return { ok: true, place: toRow(existing[0]), created: false };

  const row = {
    id: crypto.randomUUID(),
    placeId: input.details.placeId,
    name: input.details.name,
    lat: input.details.lat,
    lng: input.details.lng,
    formattedAddress: input.details.formattedAddress,
    cityId,
    areaId,
    type: displayType(input.details.primaryType),
    extraTags: input.extraTags ?? [],
    notes: input.notes,
    rating: input.details.rating,
    googleMapsUrl: input.details.googleMapsUri,
    photoName: input.details.photoName,
    authorAttributions: input.details.authorAttributions,
    seedFeatureCid: input.seedFeatureCid ?? null,
  };

  await db.insert(places).values(row);
  return { ok: true, place: row, created: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/place-insert.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Add the shared place insert path

* Infer or fall back to city by policy; never block on a missing area
* Reuse rows on `(place_id, city_id)` and stored seed feature-id/CID
EOF
git add src/lib/place-insert.ts src/lib/place-insert.test.ts
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
