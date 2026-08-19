> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 5: Slim the city index; fetch card fields on open

**Files:**
- Modify: `src/lib/places-types.ts`
- Modify: `src/actions/browse.ts`
- Modify: `src/actions/browse.test.ts`
- Modify: `src/app/(browse)/page.tsx`
- Modify: `src/components/app-shell.tsx` (prop type only if `getPlaceCard` is added here; wiring/pending UI is task 6 — **this task must still compile**. Add `getPlaceCard` to `AppShellActions` and pass it through; do not change open-sheet behavior yet except that `page.tsx` supplies the action)
- Modify fixtures that type-check as `BrowsePayload` object literals: `src/components/browse-app.test.tsx`, `src/components/app-shell.test.tsx`
- Test: `src/actions/browse.test.ts`, `src/lib/filters.test.ts` (must still pass unchanged)

**Interfaces:**
- Consumes: Task 1 joined fetch; `toPlaceRow`; `PlaceFilterable` haystack (notes stay)
- Produces: `PlaceIndex`, `PlaceCardFields`, `BrowsePlace = PlaceIndex & PlaceCardFields`, `hasCardFields`, `BrowsePayload.places: PlaceIndex[]`, `getPlaceCardWithDeps`, `getPlaceCard`. City select **must not** include `seedFeatureCid`, `rating`, `googleMapsUrl`, or `authorAttributions`. Search still matches notes.

Do not naive-page the index. Do not drop `notes` from `PlaceIndex`. Do not implement sheet pending UI (task 6). Mutations keep returning full `BrowsePlace` via `toBrowsePlace`.

This task runs after the `(browse)` move and the map-view split. Do not recreate `src/app/page.tsx`.

- [ ] **Step 1: Write the failing tests**

Add to `src/actions/browse.test.ts`:

```ts
import { getPlaceCardWithDeps, getBrowsePayloadWithDeps } from "./browse";

  it("keeps notes on the city index and omits card-only fields", async () => {
    const { db, client } = await createTestDb();
    await insertPlace(db, {
      details: downtown,
      notes: "quiet stacks",
      cityPolicy: { type: "seed" },
    });
    const payload = await getBrowsePayloadWithDeps(db, "user-1", null);
    expect(payload.places[0]?.notes).toBe("quiet stacks");
    expect(payload.places[0]).not.toHaveProperty("seedFeatureCid");
    expect(payload.places[0]).not.toHaveProperty("googleMapsUrl");
    expect(payload.places[0]).not.toHaveProperty("authorAttributions");
    expect(payload.places[0]).not.toHaveProperty("rating");
    await client.close();
  });

  it("loads card fields for one place", async () => {
    const { db, client } = await createTestDb();
    const inserted = await insertPlace(db, {
      details: downtown,
      notes: "quiet stacks",
      cityPolicy: { type: "seed" },
    });
    expect(inserted.ok).toBe(true);
    if (!inserted.ok) return;
    const card = await getPlaceCardWithDeps(db, inserted.place.id);
    expect(card?.notes).toBe("quiet stacks");
    expect(card?.googleMapsUrl).toBe(downtown.googleMapsUri);
    expect(card?.rating).toBe(4.5);
    expect(card?.areaName).toBe("Downtown");
    expect(card).not.toHaveProperty("seedFeatureCid");
    await client.close();
  });
```

Use the existing Austin fixture if it is named `austin` rather than `downtown`. `insertPlace` stores `details.googleMapsUri` as `googleMapsUrl`.

Do **not** weaken `src/lib/filters.test.ts`. After this task, `npx vitest run src/lib/filters.test.ts` must still pass: query `"quiet"` matches notes.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/actions/browse.test.ts src/lib/filters.test.ts`

Expected: FAIL — city payload still has `googleMapsUrl` / `seedFeatureCid`; `getPlaceCardWithDeps` is not exported.

- [ ] **Step 3: Write minimal implementation**

`src/lib/places-types.ts` — after `PlaceRow`, replace `BrowsePlace` / `BrowsePayload` with the types in overview.md (`PlaceIndex`, `PlaceCardFields`, `BrowsePlace`, `hasCardFields`, `BrowsePayload.places: PlaceIndex[]`). Keep `PlaceRow` including `seedFeatureCid` for insert/seed.

Helper on the same file:

```ts
export function hasCardFields(
  place: PlaceIndex | BrowsePlace,
): place is BrowsePlace {
  return "googleMapsUrl" in place && "authorAttributions" in place;
}
```

`src/actions/browse.ts` — change the joined select to named index columns (not `place: places` whole row):

```ts
  const joined = await database
    .select({
      id: places.id,
      placeId: places.placeId,
      name: places.name,
      lat: places.lat,
      lng: places.lng,
      formattedAddress: places.formattedAddress,
      cityId: places.cityId,
      areaId: places.areaId,
      type: places.type,
      extraTags: places.extraTags,
      notes: places.notes,
      photoName: places.photoName,
      areaName: areas.name,
    })
    .from(places)
    .leftJoin(areas, eq(places.areaId, areas.id))
    .where(eq(places.cityId, requested.id));

  const browsePlaces = joined.map((row) => ({
    id: row.id,
    placeId: row.placeId,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    formattedAddress: row.formattedAddress,
    cityId: row.cityId,
    areaId: row.areaId,
    areaName: row.areaName ?? null,
    type: row.type,
    extraTags: row.extraTags,
    notes: row.notes,
    photoName: row.photoName,
  }));
```

Derive `types`, `extraTags`, `areas` from `browsePlaces` as in task 1 (use `areaId` + `areaName` instead of `row.place.areaId`).

Add:

```ts
export async function getPlaceCardWithDeps(
  database: BopDb,
  placeId: string,
): Promise<BrowsePlace | null> {
  const rows = await database
    .select({
      place: places,
      areaName: areas.name,
    })
    .from(places)
    .leftJoin(areas, eq(places.areaId, areas.id))
    .where(eq(places.id, placeId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const full = toPlaceRow(row.place);
  return {
    id: full.id,
    placeId: full.placeId,
    name: full.name,
    lat: full.lat,
    lng: full.lng,
    formattedAddress: full.formattedAddress,
    cityId: full.cityId,
    areaId: full.areaId,
    areaName: row.areaName ?? null,
    type: full.type,
    extraTags: full.extraTags,
    notes: full.notes,
    photoName: full.photoName,
    rating: full.rating,
    googleMapsUrl: full.googleMapsUrl,
    authorAttributions: full.authorAttributions,
  };
}

export async function getPlaceCard(placeId: string) {
  await requireAllowedSession();
  return getPlaceCardWithDeps(db, placeId);
}
```

Import `BrowsePlace` next to `BrowsePayload`.

`AppShellActions` in `src/components/app-shell.tsx`:

```ts
getPlaceCard: (placeId: string) => Promise<BrowsePlace | null>;
```

Page (whichever path exists):

```tsx
import { changeCity, getBrowsePayloadWithDeps, getPlaceCard } from "@/actions/browse";
// ...
<AppShell
  initial={initial}
  onCityChange={changeCity}
  getPlaceCard={getPlaceCard}
  searchPlaces={searchPlaces}
  addPlace={addPlace}
  updatePlace={updatePlace}
  deletePlace={deletePlace}
  movePlace={movePlace}
  createArea={createArea}
/>
```

`AppShell` must accept and ignore `getPlaceCard` for now (prefix with underscore in the destructure if unused: do not omit it from the props type). Existing tests that render `AppShell` must pass a stub:

```ts
getPlaceCard={async () => place}
```

where `place` is the full `BrowsePlace` fixture.

`BrowsePayload` object literals in tests: remove `seedFeatureCid`, `rating`, `googleMapsUrl`, and `authorAttributions` from **`payload.places`** entries. Keep those fields on standalone `BrowsePlace` constants used as add/update results (they are `BrowsePlace`, not `PlaceIndex`).

`PlaceList` / `MapView` / `BrowseApp` can keep taking the same prop names; `PlaceIndex[]` is the payload array. If a component is typed as `BrowsePlace[]`, change it to `PlaceIndex[]` so index rows type-check. `addPlace` return type stays `BrowsePlace`.

`map-view.test.tsx` / `place-list.test.tsx`: if they construct `BrowsePlace`, extra fields are still valid. If they construct `BrowsePayload`, strip card fields from `places`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/actions/browse.test.ts src/lib/filters.test.ts src/components/app-shell.test.tsx src/components/browse-app.test.tsx src/components/place-list.test.tsx`

Expected: PASS. Then `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/places-types.ts src/actions/browse.ts src/actions/browse.test.ts src/components/app-shell.tsx src/components/app-shell.test.tsx src/components/browse-app.test.tsx src/components/place-list.tsx src/components/map-view.tsx src/components/map-canvas.tsx src/components/map-view.test.tsx src/app/\(browse\)/page.tsx
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Keep filter fields on the city index and load card fields on demand

* Drop seed, rating, Maps URL, and attributions from `BrowsePayload.places`
* Add `getPlaceCardWithDeps` for the detail card
EOF
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```

`git add` only paths that exist and changed.
