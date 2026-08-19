> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 5: Client-side place filters

**Files:**
- Create: `src/lib/filters.ts`
- Create: `src/lib/filters.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `PlaceFilterable`, `PlaceFilters`, `filterPlaces`, `haversineKm`, `sortByDistance` as specified in overview.md

- [ ] **Step 1: Write the failing tests**

Create `src/lib/filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  filterPlaces,
  haversineKm,
  sortByDistance,
  type PlaceFilterable,
} from "./filters";

const places: PlaceFilterable[] = [
  {
    name: "Slant of Light Books",
    formattedAddress: "123 E 7th St, Austin, TX",
    notes: "Quiet used books",
    type: "book store",
    extraTags: ["rainy-day"],
    areaId: "east",
    lat: 30.267,
    lng: -97.743,
  },
  {
    name: "Nickel City",
    formattedAddress: "Austin, TX",
    notes: "Dive bar",
    type: "bar",
    extraTags: ["late"],
    areaId: "east",
    lat: 30.26,
    lng: -97.72,
  },
  {
    name: "Houndstooth",
    formattedAddress: "South Congress, Austin",
    notes: "",
    type: "cafe",
    extraTags: ["coffee"],
    areaId: "south",
    lat: 30.25,
    lng: -97.75,
  },
];

const none = {
  query: "",
  type: null,
  areaId: null,
  extraTag: null,
};

describe("filterPlaces", () => {
  it("matches free text against name, address, notes, type, and extra tags", () => {
    expect(filterPlaces(places, { ...none, query: "quiet" }).map((p) => p.name)).toEqual([
      "Slant of Light Books",
    ]);
    expect(filterPlaces(places, { ...none, query: "congress" }).map((p) => p.name)).toEqual([
      "Houndstooth",
    ]);
    expect(filterPlaces(places, { ...none, query: "book store" }).map((p) => p.name)).toEqual([
      "Slant of Light Books",
    ]);
    expect(filterPlaces(places, { ...none, query: "late" }).map((p) => p.name)).toEqual([
      "Nickel City",
    ]);
  });

  it("filters type, area, and extra tag exactly", () => {
    expect(filterPlaces(places, { ...none, type: "bar" }).map((p) => p.name)).toEqual([
      "Nickel City",
    ]);
    expect(filterPlaces(places, { ...none, areaId: "south" }).map((p) => p.name)).toEqual([
      "Houndstooth",
    ]);
    expect(
      filterPlaces(places, { ...none, extraTag: "rainy-day" }).map((p) => p.name),
    ).toEqual(["Slant of Light Books"]);
  });

  it("ANDs combined filters", () => {
    expect(
      filterPlaces(places, {
        query: "austin",
        type: "bar",
        areaId: "east",
        extraTag: "late",
      }).map((p) => p.name),
    ).toEqual(["Nickel City"]);
    expect(
      filterPlaces(places, {
        query: "austin",
        type: "bar",
        areaId: "south",
        extraTag: null,
      }),
    ).toEqual([]);
  });
});

describe("sortByDistance", () => {
  it("orders nearer places first", () => {
    const origin = { lat: 30.267, lng: -97.743 };
    const sorted = sortByDistance(places, origin);
    expect(sorted[0]?.name).toBe("Slant of Light Books");
    expect(haversineKm(origin, sorted[0]!)).toBeLessThan(
      haversineKm(origin, sorted[1]!),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/filters.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/lib/filters.ts`:

```ts
export type PlaceFilterable = {
  name: string;
  formattedAddress: string;
  notes: string;
  type: string | null;
  extraTags: string[];
  areaId: string | null;
  lat: number;
  lng: number;
};

export type PlaceFilters = {
  query: string;
  type: string | null;
  areaId: string | null;
  extraTag: string | null;
};

function haystack(place: PlaceFilterable): string {
  return [
    place.name,
    place.formattedAddress,
    place.notes,
    place.type ?? "",
    ...place.extraTags,
  ]
    .join(" ")
    .toLowerCase();
}

export function filterPlaces<T extends PlaceFilterable>(
  places: T[],
  filters: PlaceFilters,
): T[] {
  const q = filters.query.trim().toLowerCase();
  return places.filter((place) => {
    if (q && !haystack(place).includes(q)) return false;
    if (filters.type && place.type !== filters.type) return false;
    if (filters.areaId && place.areaId !== filters.areaId) return false;
    if (filters.extraTag && !place.extraTags.includes(filters.extraTag)) {
      return false;
    }
    return true;
  });
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

export function sortByDistance<T extends { lat: number; lng: number }>(
  places: T[],
  origin: { lat: number; lng: number },
): T[] {
  return [...places].sort(
    (x, y) => haversineKm(origin, x) - haversineKm(origin, y),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/filters.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Add client-side place filters and distance sort

* Filter by free text, type, area, and extra tag
* Sort near-me results with haversine distance
EOF
git add src/lib/filters.ts src/lib/filters.test.ts
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
