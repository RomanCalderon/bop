> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 1: Join areas in city fetch

**Files:**
- Modify: `src/actions/browse.ts`
- Modify: `src/actions/browse.test.ts`
- Test: `src/actions/browse.test.ts`

**Interfaces:**
- Consumes: `BopDb`, `places`, `areas`, `cities`, `userPreferences`; `toPlaceRow` from `src/actions/place-view.ts`; `BrowsePayload` (still `BrowsePlace[]` until task 5)
- Produces: `getBrowsePayloadWithDeps` loads area names via one `places` ⋈ `areas` query. It does **not** call `toBrowsePlace`. When `cityId` matches a listed city, it does **not** query `user_preferences`. `types` / `extraTags` / `areas` are derived from the joined rows.

`toBrowsePlace` in `src/actions/place-view.ts` stays exported for add/update/move. Do not delete it. Do not slim payload columns in this task (that is task 5).

- [ ] **Step 1: Write the failing tests**

Add to `src/actions/browse.test.ts`. Keep the existing three tests. Do **not** `vi.spyOn(toBrowsePlace)` — `browse.ts` already bound that import, so the spy will not fail today. Log SQL instead:

```ts
import { describe, expect, it } from "vitest";
import { user } from "@/db/schema";
import { createTestDb } from "@/test/pglite";
import { insertPlace } from "@/lib/place-insert";
import type { PlaceDetails } from "@/lib/places-types";
import { getBrowsePayloadWithDeps, setLastCityWithDeps } from "./browse";

function spySql(client: { query: (...args: never[]) => unknown }) {
  const sql: string[] = [];
  const original = client.query.bind(client);
  client.query = ((query: string, ...rest: never[]) => {
    sql.push(query);
    return original(query, ...rest);
  }) as typeof client.query;
  return sql;
}

const downtown: PlaceDetails = {
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

const eastAustin: PlaceDetails = {
  ...downtown,
  placeId: "ChIJ-e",
  name: "Cafe",
  addressComponents: [
    { types: ["locality"], longText: "Austin" },
    { types: ["neighborhood"], longText: "East Austin" },
  ],
  primaryType: "cafe",
};

const chicago: PlaceDetails = {
  ...downtown,
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
```

(Reuse the existing `austin` / `chicago` fixtures if they are already in the file; do not duplicate `austin` under two names. Add `eastAustin` next to them.)

New tests inside `describe("getBrowsePayloadWithDeps")`:

```ts
  it("joins area names in one query and does not call toBrowsePlace per place", async () => {
    const { db, client } = await createTestDb();
    await insertPlace(db, { details: downtown, notes: "quiet", cityPolicy: { type: "seed" } });
    await insertPlace(db, { details: eastAustin, notes: "", cityPolicy: { type: "seed" } });
    await insertPlace(db, {
      details: { ...downtown, placeId: "ChIJ-a2", name: "Records" },
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
      (s) => /from\s+"?areas"?/i.test(s) && /"?id"?\s*=/i.test(s) && !/city_id/i.test(s),
    );
    expect(areaByIdLookups).toEqual([]);
    await client.close();
  });

  it("does not read user_preferences when cityId is provided", async () => {
    const { db, client } = await createTestDb();
    const a = await insertPlace(db, { details: downtown, notes: "", cityPolicy: { type: "seed" } });
    const c = await insertPlace(db, { details: chicago, notes: "", cityPolicy: { type: "seed" } });
    expect(a.ok && c.ok).toBe(true);
    if (!a.ok || !c.ok) return;

    const sql = spySql(client);
    const payload = await getBrowsePayloadWithDeps(db, "user-1", c.place.cityId);
    expect(payload.city?.name).toBe("Chicago");
    expect(sql.some((s) => /user_preferences/i.test(s))).toBe(false);
    await client.close();
  });
```

If PGlite logs through `exec` instead of `query`, wrap `exec` the same way (push the SQL string, call through). Today each `toBrowsePlace` emits an `areas` lookup `where id = $1`; with three placed rows that array is length 3. After the join it must be empty.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/actions/browse.test.ts`

Expected: FAIL — `toBrowsePlace` is called, and/or `areaByIdLookups` is non-empty; the prefs test sees `user_preferences` in SQL even when `cityId` is passed.

- [ ] **Step 3: Write minimal implementation**

In `src/actions/browse.ts`, replace the places + areas + `toBrowsePlace` block. Remove the `toBrowsePlace` import; keep `toPlaceRow`.

```ts
import { asc, count, eq } from "drizzle-orm";
import { db, type BopDb } from "@/db";
import { areas, cities, places, userPreferences } from "@/db/schema";
import { toPlaceRow } from "@/actions/place-view";
import type { BrowsePayload } from "@/lib/places-types";
import { requireAllowedSession } from "@/lib/require-allowed";

export async function getBrowsePayloadWithDeps(
  database: BopDb,
  userId: string,
  cityId: string | null,
): Promise<BrowsePayload> {
  const cityRows = await database
    .select({
      id: cities.id,
      name: cities.name,
      centerLat: cities.centerLat,
      centerLng: cities.centerLng,
      placeCount: count(places.id),
    })
    .from(cities)
    .leftJoin(places, eq(places.cityId, cities.id))
    .groupBy(cities.id)
    .orderBy(asc(cities.name));

  const listed = cityRows.map((c) => ({
    id: c.id,
    name: c.name,
    placeCount: Number(c.placeCount),
  }));

  const fromId = cityId ? cityRows.find((c) => c.id === cityId) : undefined;

  let requested = fromId ?? null;
  if (!requested) {
    const pref = await database
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);
    requested =
      (pref[0]?.lastCityId &&
        cityRows.find((c) => c.id === pref[0].lastCityId)) ||
      [...cityRows].sort((a, b) => {
        const byCount = Number(b.placeCount) - Number(a.placeCount);
        return byCount !== 0 ? byCount : a.name.localeCompare(b.name);
      })[0] ||
      null;
  }

  if (!requested) {
    return {
      city: null,
      cities: listed,
      places: [],
      types: [],
      areas: [],
      extraTags: [],
    };
  }

  const joined = await database
    .select({
      place: places,
      areaName: areas.name,
    })
    .from(places)
    .leftJoin(areas, eq(places.areaId, areas.id))
    .where(eq(places.cityId, requested.id));

  const browsePlaces = joined.map((row) => ({
    ...toPlaceRow(row.place),
    areaName: row.areaName ?? null,
  }));
  const types = [
    ...new Set(browsePlaces.map((p) => p.type).filter((t): t is string => Boolean(t))),
  ].sort();
  const extraTags = [...new Set(browsePlaces.flatMap((p) => p.extraTags))].sort();
  const areaById = new Map<string, string>();
  for (const row of joined) {
    if (row.place.areaId && row.areaName) {
      areaById.set(row.place.areaId, row.areaName);
    }
  }
  const cityAreas = [...areaById.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    city: {
      id: requested.id,
      name: requested.name,
      centerLat: requested.centerLat,
      centerLng: requested.centerLng,
    },
    cities: listed,
    places: browsePlaces,
    types,
    areas: cityAreas,
    extraTags,
  };
}
```

Leave `getBrowsePayload`, `setLastCity`, `changeCity`, and `setLastCityWithDeps` as they are.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/actions/browse.test.ts`

Expected: PASS (existing three tests plus the two new ones).

- [ ] **Step 5: Commit**

```bash
git add src/actions/browse.ts src/actions/browse.test.ts
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Join areas once when loading a city's browse payload

* Stop calling `toBrowsePlace` per place in `getBrowsePayloadWithDeps`
* Skip `user_preferences` when a matching `cityId` is already provided
EOF
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
