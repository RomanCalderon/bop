> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 11: Browse payload, preferences, settings, edits

**Files:**
- Create: `src/actions/browse.ts`
- Create: `src/actions/browse.test.ts`
- Create: `src/actions/settings.ts`
- Create: `src/actions/settings.test.ts`
- Modify: `src/actions/places.ts` (add `updatePlace`, `deletePlace`, `movePlace` and `*WithDeps` test exports)
- Create: `src/actions/place-edits.test.ts`

**Interfaces:**
- Consumes: `toBrowsePlace` from `src/actions/place-view.ts`; `BrowsePayload`, `BrowsePlace`; `normalizeEmail`, `parseAllowedEmailsEnv`, `isEmailAllowed`; schema tables; `requireAllowedSession` for the public actions
- Produces: `getBrowsePayload`, `setLastCity`, `listAllowedEmails`, `inviteEmail`, `removeAllowedEmail`, `renameCity`, `createArea`, `updatePlace`, `deletePlace`, `movePlace` as specified in overview.md

- [ ] **Step 1: Write the failing tests**

`src/actions/browse.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { user } from "@/db/schema";
import { createTestDb } from "@/test/pglite";
import { insertPlace } from "@/lib/place-insert";
import type { PlaceDetails } from "@/lib/places-types";
import { getBrowsePayloadWithDeps, setLastCityWithDeps } from "./browse";

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

describe("getBrowsePayloadWithDeps", () => {
  it("defaults to the city with the most places when no preference is stored", async () => {
    const { db, client } = await createTestDb();
    await insertPlace(db, { details: austin, notes: "", cityPolicy: { type: "seed" } });
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
});
```

Fix the sloppy types assertion in the first test — keep only:

```ts
    expect(payload.types).toEqual(["book store"]);
```

`src/actions/settings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { allowedEmails } from "@/db/schema";
import { createTestDb } from "@/test/pglite";
import {
  inviteEmailWithDeps,
  listAllowedEmailsWithDeps,
  removeAllowedEmailWithDeps,
} from "./settings";

describe("allowlist settings", () => {
  it("inviting an already-allowed email is a no-op", async () => {
    const { db, client } = await createTestDb();
    const first = await inviteEmailWithDeps(db, "Ada@X.com", "ada@x.com");
    const second = await inviteEmailWithDeps(db, "ada@x.com", "ada@x.com");
    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    const rows = await db.select().from(allowedEmails);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("ada@x.com");
    await client.close();
  });

  it("cannot remove an env email", async () => {
    const { db, client } = await createTestDb();
    const result = await removeAllowedEmailWithDeps(
      db,
      "ada@x.com",
      "ada@x.com",
    );
    expect(result).toEqual({
      ok: false,
      message: "That email is allowed by the server list.",
    });
    await client.close();
  });

  it("lists env and table separately", async () => {
    const { db, client } = await createTestDb();
    await inviteEmailWithDeps(db, "bob@x.com", "ada@x.com");
    const listed = await listAllowedEmailsWithDeps(db, "ada@x.com");
    expect(listed.env).toEqual(["ada@x.com"]);
    expect(listed.table).toEqual(["bob@x.com"]);
    await client.close();
  });
});
```

`src/actions/place-edits.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/actions/browse.test.ts src/actions/settings.test.ts src/actions/place-edits.test.ts`
Expected: FAIL — exports missing.

- [ ] **Step 3: Write the actions**

`src/actions/browse.ts`:

```ts
"use server";

import { asc, count, eq } from "drizzle-orm";
import { db, type BopDb } from "@/db";
import { areas, cities, places, userPreferences } from "@/db/schema";
import { toBrowsePlace } from "@/actions/place-view";
import type { BrowsePayload, PlaceRow } from "@/lib/places-types";
import { requireAllowedSession } from "@/lib/require-allowed";

export function toPlaceRow(row: typeof places.$inferSelect): PlaceRow {
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

  const pref = await database
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  const requested =
    (cityId && cityRows.find((c) => c.id === cityId)) ||
    (pref[0]?.lastCityId &&
      cityRows.find((c) => c.id === pref[0].lastCityId)) ||
    [...cityRows].sort((a, b) => {
      const byCount = Number(b.placeCount) - Number(a.placeCount);
      return byCount !== 0 ? byCount : a.name.localeCompare(b.name);
    })[0] ||
    null;

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

  const placeRows = await database
    .select()
    .from(places)
    .where(eq(places.cityId, requested.id));
  const areaRows = await database
    .select()
    .from(areas)
    .where(eq(areas.cityId, requested.id));
  const browsePlaces = await Promise.all(
    placeRows.map((row) => toBrowsePlace(database, toPlaceRow(row))),
  );
  const types = [...new Set(browsePlaces.map((p) => p.type).filter((t): t is string => Boolean(t)))].sort();
  const extraTags = [...new Set(browsePlaces.flatMap((p) => p.extraTags))].sort();

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
    areas: areaRows.map((a) => ({ id: a.id, name: a.name })),
    extraTags,
  };
}

export async function setLastCityWithDeps(
  database: BopDb,
  userId: string,
  cityId: string,
) {
  await database
    .insert(userPreferences)
    .values({ userId, lastCityId: cityId })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { lastCityId: cityId },
    });
  return { ok: true as const };
}

export async function getBrowsePayload(cityId?: string | null) {
  const session = await requireAllowedSession();
  return getBrowsePayloadWithDeps(db, session.id, cityId ?? null);
}

export async function setLastCity(cityId: string) {
  const session = await requireAllowedSession();
  return setLastCityWithDeps(db, session.id, cityId);
}

export async function changeCity(cityId: string) {
  await setLastCity(cityId);
  return getBrowsePayload(cityId);
}
```

`user_preferences` upsert requires a unique target on `user_id` (it is the primary key). If Drizzle's PGlite driver rejects `onConflictDoUpdate`, use select-then-insert/update instead.

`src/actions/settings.ts`:

```ts
import { eq } from "drizzle-orm";
import type { BopDb } from "@/db";
import { allowedEmails, cities } from "@/db/schema";
import {
  isEmailAllowed,
  normalizeEmail,
  parseAllowedEmailsEnv,
} from "@/lib/allowlist";

export async function inviteEmailWithDeps(
  db: BopDb,
  email: string,
  envValue: string | undefined,
) {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) {
    return { ok: false as const, message: "Enter a valid email." };
  }
  const envList = parseAllowedEmailsEnv(envValue);
  const table = await db.select().from(allowedEmails);
  if (isEmailAllowed(normalized, envList, table.map((r) => r.email))) {
    return { ok: true as const };
  }
  await db.insert(allowedEmails).values({
    id: crypto.randomUUID(),
    email: normalized,
  });
  return { ok: true as const };
}

export async function removeAllowedEmailWithDeps(
  db: BopDb,
  email: string,
  envValue: string | undefined,
) {
  const normalized = normalizeEmail(email);
  if (parseAllowedEmailsEnv(envValue).includes(normalized)) {
    return {
      ok: false as const,
      message: "That email is allowed by the server list.",
    };
  }
  await db.delete(allowedEmails).where(eq(allowedEmails.email, normalized));
  return { ok: true as const };
}

export async function listAllowedEmailsWithDeps(
  db: BopDb,
  envValue: string | undefined,
) {
  const env = parseAllowedEmailsEnv(envValue);
  const table = (await db.select().from(allowedEmails)).map((r) => r.email);
  return { env, table };
}

export async function renameCityWithDeps(
  db: BopDb,
  cityId: string,
  name: string,
) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, message: "Name required." };
  try {
    await db.update(cities).set({ name: trimmed }).where(eq(cities.id, cityId));
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "A city with that name already exists." };
  }
}
```

Public settings wrappers:

```ts
"use server";

import { db } from "@/db";
import { requireAllowedSession } from "@/lib/require-allowed";

export async function inviteEmail(email: string) {
  await requireAllowedSession();
  return inviteEmailWithDeps(db, email, process.env.ALLOWED_EMAILS);
}

export async function removeAllowedEmail(email: string) {
  await requireAllowedSession();
  return removeAllowedEmailWithDeps(db, email, process.env.ALLOWED_EMAILS);
}

export async function listAllowedEmails() {
  await requireAllowedSession();
  return listAllowedEmailsWithDeps(db, process.env.ALLOWED_EMAILS);
}

export async function renameCity(cityId: string, name: string) {
  await requireAllowedSession();
  return renameCityWithDeps(db, cityId, name);
}

export async function createArea(cityId: string, name: string) {
  await requireAllowedSession();
  return createAreaWithDeps(db, cityId, name);
}
```

`createAreaWithDeps` — add to `src/actions/settings.ts`:

```ts
export async function createAreaWithDeps(
  db: BopDb,
  cityId: string,
  name: string,
) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, message: "Name required." };
  const existing = await db
    .select()
    .from(areas)
    .where(
      and(
        eq(areas.cityId, cityId),
        sql`lower(${areas.name}) = ${trimmed.toLowerCase()}`,
      ),
    )
    .limit(1);
  if (existing[0]) {
    return { ok: true as const, area: { id: existing[0].id, name: existing[0].name } };
  }
  const id = crypto.randomUUID();
  await db.insert(areas).values({ id, cityId, name: trimmed });
  return { ok: true as const, area: { id, name: trimmed } };
}
```

Import `and`, `sql`, and `areas` at the top of `settings.ts`.

In `src/actions/places.ts` add (import `toPlaceRow` from `./browse`):

```ts
export async function updatePlaceWithDeps(
  db: BopDb,
  id: string,
  patch: {
    notes?: string;
    extraTags?: string[];
    type?: string | null;
    areaId?: string | null;
    cityId?: string;
  },
) {
  const [current] = await db.select().from(places).where(eq(places.id, id));
  if (!current) return { ok: false as const, message: "Place not found." };
  if (patch.cityId && patch.cityId !== current.cityId) {
    return movePlaceWithDeps(db, id, patch.cityId);
  }
  await db
    .update(places)
    .set({
      notes: patch.notes ?? current.notes,
      extraTags: patch.extraTags ?? current.extraTags,
      type: patch.type === undefined ? current.type : patch.type,
      areaId: patch.areaId === undefined ? current.areaId : patch.areaId,
    })
    .where(eq(places.id, id));
  const [next] = await db.select().from(places).where(eq(places.id, id));
  return { ok: true as const, place: await toBrowsePlace(db, toPlaceRow(next!)) };
}

export async function movePlaceWithDeps(
  db: BopDb,
  id: string,
  toCityId: string,
) {
  const [current] = await db.select().from(places).where(eq(places.id, id));
  if (!current) return { ok: false as const, message: "Place not found." };
  const [dup] = await db
    .select()
    .from(places)
    .where(and(eq(places.placeId, current.placeId), eq(places.cityId, toCityId)));
  if (dup) {
    return {
      ok: false as const,
      message: "Already saved in that city.",
      existingPlaceId: dup.id,
    };
  }
  await db
    .update(places)
    .set({ cityId: toCityId, areaId: null })
    .where(eq(places.id, id));
  const [next] = await db.select().from(places).where(eq(places.id, id));
  return { ok: true as const, place: await toBrowsePlace(db, toPlaceRow(next!)) };
}

export async function deletePlaceWithDeps(db: BopDb, id: string) {
  await db.delete(places).where(eq(places.id, id));
  return { ok: true as const };
}
```

Clear `areaId` on move because areas are city-scoped. Import `toPlaceRow` from `./browse` and `toBrowsePlace` from `./place-view`.

Public wrappers:

```ts
export async function updatePlace(
  id: string,
  patch: {
    notes?: string;
    extraTags?: string[];
    type?: string | null;
    areaId?: string | null;
    cityId?: string;
  },
) {
  try {
    await requireAllowedSession();
  } catch {
    return { ok: false as const, message: "Couldn't save, try again." };
  }
  return updatePlaceWithDeps(db, id, patch);
}

export async function movePlace(id: string, toCityId: string) {
  try {
    await requireAllowedSession();
  } catch {
    return { ok: false as const, message: "Couldn't save, try again." };
  }
  return movePlaceWithDeps(db, id, toCityId);
}

export async function deletePlace(id: string) {
  try {
    await requireAllowedSession();
  } catch {
    return { ok: false as const, message: "Couldn't save, try again." };
  }
  return deletePlaceWithDeps(db, id);
}

export async function searchPlaces(input: string) {
  try {
    await requireAllowedSession();
  } catch {
    return { ok: false as const, message: "Couldn't find that — try a more specific name." };
  }
  const suggestions = await createPlacesClient(
    process.env.GOOGLE_PLACES_SERVER_KEY ?? "",
  ).autocomplete(input);
  if (suggestions.length === 0) {
    return { ok: false as const, message: "Couldn't find that — try a more specific name." };
  }
  return { ok: true as const, suggestions };
}

export async function addPlace(placeId: string, currentCityId: string | null) {
  try {
    await requireAllowedSession();
  } catch {
    return { ok: false as const, message: "Couldn't save, try again." };
  }
  return addPlaceWithDeps({
    db,
    places: createPlacesClient(process.env.GOOGLE_PLACES_SERVER_KEY ?? ""),
    placeId,
    currentCityId,
  });
}
```

`searchPlaces` / `addPlace` belong in this file from Task 10; if they are already present, keep a single copy.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/actions/browse.test.ts src/actions/settings.test.ts src/actions/place-edits.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Add browse payload, last-city preference, and settings edits

* Select last-used city or the city with the most places
* Invite/remove table emails and block moves that collide on place_id
EOF
git add src/actions/browse.ts src/actions/browse.test.ts src/actions/settings.ts src/actions/settings.test.ts src/actions/places.ts src/actions/place-edits.test.ts
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
