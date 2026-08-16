> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 12: Browse UI — layout, map, list, chips, empty states

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/browse-app.tsx`
- Create: `src/components/browse-app.test.tsx`
- Create: `src/components/place-list.tsx`
- Create: `src/components/filter-bar.tsx`
- Create: `src/components/map-view.tsx`
- Create: `src/lib/map-style.ts`
- Create: `src/components/city-switcher.tsx`
- Create: `src/app/error.tsx`

**Interfaces:**
- Consumes: `BrowsePayload`, `BrowsePlace` from `src/lib/places-types.ts`; `filterPlaces`, `sortByDistance`, `haversineKm` from `src/lib/filters.ts`; `getBrowsePayload`, `setLastCity` from `src/actions/browse.ts`
- Produces: Server `page.tsx` fetches payload and renders a client island; chips and search filter list + marker ids together; city switch reloads payload and recenters; empty states as specified in overview.md

Keep `"use client"` on `browse-app.tsx`, `filter-bar.tsx`, `place-list.tsx`, `map-view.tsx`, and `city-switcher.tsx` only. `page.tsx` stays a Server Component.

- [ ] **Step 1: Write the failing UI tests**

`src/components/browse-app.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BrowseApp } from "./browse-app";
import type { BrowsePayload } from "@/lib/places-types";

vi.mock("./map-view", () => ({
  MapView: ({
    markerIds,
  }: {
    markerIds: string[];
  }) => <div data-testid="markers">{markerIds.join(",")}</div>,
}));

const payload: BrowsePayload = {
  city: { id: "c1", name: "Austin", centerLat: 30.27, centerLng: -97.74 },
  cities: [
    { id: "c1", name: "Austin", placeCount: 2 },
    { id: "c2", name: "Chicago", placeCount: 1 },
  ],
  types: ["bar", "book store"],
  areas: [{ id: "east", name: "East" }],
  extraTags: ["late"],
  places: [
    {
      id: "p1",
      placeId: "ChIJ1",
      name: "Slant of Light Books",
      lat: 30.27,
      lng: -97.74,
      formattedAddress: "Austin",
      cityId: "c1",
      areaId: "east",
      areaName: "East",
      type: "book store",
      extraTags: [],
      notes: "Quiet",
      rating: 4.8,
      googleMapsUrl: "https://maps.google.com/?cid=1",
      photoName: null,
      authorAttributions: [],
      seedFeatureCid: null,
    },
    {
      id: "p2",
      placeId: "ChIJ2",
      name: "Nickel City",
      lat: 30.26,
      lng: -97.72,
      formattedAddress: "Austin",
      cityId: "c1",
      areaId: "east",
      areaName: "East",
      type: "bar",
      extraTags: ["late"],
      notes: "",
      rating: null,
      googleMapsUrl: "https://maps.google.com/?cid=2",
      photoName: null,
      authorAttributions: [],
      seedFeatureCid: null,
    },
  ],
};

describe("BrowseApp", () => {
  it("filters the list and marker ids together", async () => {
    const user = userEvent.setup();
    render(
      <BrowseApp
        payload={payload}
        onCityChange={async () => payload}
      />,
    );
    expect(screen.getByText("Slant of Light Books")).toBeInTheDocument();
    expect(screen.getByTestId("markers").textContent).toContain("p1");
    await user.click(screen.getByRole("button", { name: "bar" }));
    expect(screen.queryByText("Slant of Light Books")).not.toBeInTheDocument();
    expect(screen.getByText("Nickel City")).toBeInTheDocument();
    expect(screen.getByTestId("markers").textContent).toBe("p2");
  });

  it("shows the no-match empty state", async () => {
    const user = userEvent.setup();
    render(
      <BrowseApp
        payload={payload}
        onCityChange={async () => payload}
      />,
    );
    await user.type(screen.getByPlaceholderText("Search places"), "zzzz");
    expect(
      screen.getByText("Nothing matches — clear filters."),
    ).toBeInTheDocument();
  });

  it("shows the no-city empty state", () => {
    render(
      <BrowseApp
        payload={{
          city: null,
          cities: [],
          places: [],
          types: [],
          areas: [],
          extraTags: [],
        }}
        onCityChange={async () => payload}
      />,
    );
    expect(
      screen.getByText("Add a place to start a city."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /city/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project jsdom src/components/browse-app.test.tsx`
Expected: FAIL — `BrowseApp` not found.

- [ ] **Step 3: Write the browse UI**

`src/lib/map-style.ts` — export `bopMapStyle` as a `google.maps.MapTypeStyle[]` (or the `MapStyle` type from `@vis.gl/react-google-maps`). Use a warm paper map: desaturated landscape, cream water, muted roads, hidden POI icons (Bop pins are the POIs). Include at least:

```ts
export const bopMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#efe6d6" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5c5346" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#d7c4a3" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];
```

`src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { changeCity, getBrowsePayload } from "@/actions/browse";
import { BrowseApp } from "@/components/browse-app";
import { getAllowedSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getAllowedSession();
  if (!session.ok && session.reason === "unauthenticated") redirect("/sign-in");
  if (!session.ok && session.reason === "not_invited") redirect("/not-invited");
  const initial = await getBrowsePayload();
  return (
    <BrowseApp
      payload={initial}
      onCityChange={changeCity}
    />
  );
}
```

If passing an inline server action into a client component is awkward, export `changeCity` from `src/actions/browse.ts` instead:

```ts
export async function changeCity(cityId: string) {
  await setLastCity(cityId);
  return getBrowsePayload(cityId);
}
```

and pass `changeCity` as the `onCityChange` prop.

`src/components/browse-app.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { filterPlaces, sortByDistance } from "@/lib/filters";
import type { BrowsePayload, BrowsePlace } from "@/lib/places-types";
import { CitySwitcher } from "./city-switcher";
import { FilterBar } from "./filter-bar";
import { MapView } from "./map-view";
import { PlaceList } from "./place-list";

export function BrowseApp({
  payload,
  onCityChange,
  onOpenPlace,
  onAdd,
}: {
  payload: BrowsePayload;
  onCityChange: (cityId: string) => Promise<BrowsePayload>;
  onOpenPlace?: (place: BrowsePlace) => void;
  onAdd?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [extraTag, setExtraTag] = useState<string | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [geoDenied, setGeoDenied] = useState(false);

  const filtered = useMemo(() => {
    const next = filterPlaces(payload.places, { query, type, areaId, extraTag });
    return origin ? sortByDistance(next, origin) : next;
  }, [payload.places, query, type, areaId, extraTag, origin]);

  return (
    <div className="flex min-h-dvh flex-col md:h-dvh md:flex-row">
      <header className="flex items-center justify-between gap-2 px-4 py-3 md:hidden">
        <CitySwitcher
          cities={payload.cities}
          city={payload.city}
          onChange={async (id) => {
            await onCityChange(id);
            setType(null);
            setAreaId(null);
            setExtraTag(null);
          }}
        />
        <div className="flex gap-2">
          {!geoDenied ? (
            <button
              type="button"
              aria-label="Near me"
              onClick={() => {
                navigator.geolocation.getCurrentPosition(
                  (pos) =>
                    setOrigin({
                      lat: pos.coords.latitude,
                      lng: pos.coords.longitude,
                    }),
                  () => setGeoDenied(true),
                );
              }}
            >
              Near me
            </button>
          ) : null}
          <button type="button" aria-label="Add place" onClick={() => onAdd?.()}>
            +
          </button>
        </div>
      </header>

      <div className="h-[40vh] md:order-2 md:h-auto md:flex-1">
        <MapView
          city={payload.city}
          places={filtered}
          markerIds={filtered.map((p) => p.id)}
          onSelect={(id) => {
            const place = filtered.find((p) => p.id === id);
            if (place) onOpenPlace?.(place);
          }}
        />
      </div>

      <section className="flex min-h-0 flex-1 flex-col md:order-1 md:w-[28rem] md:border-r md:border-stone-300">
        <div className="hidden items-center justify-between px-4 py-3 md:flex">
          <CitySwitcher
            cities={payload.cities}
            city={payload.city}
            onChange={async (id) => {
              await onCityChange(id);
            }}
          />
          <button type="button" aria-label="Add place" onClick={() => onAdd?.()}>
            +
          </button>
        </div>
        <FilterBar
          query={query}
          onQuery={setQuery}
          types={payload.types}
          type={type}
          onType={setType}
          areas={payload.areas}
          areaId={areaId}
          onArea={setAreaId}
          extraTags={payload.extraTags}
          extraTag={extraTag}
          onExtraTag={setExtraTag}
        />
        <PlaceList
          places={filtered}
          origin={origin}
          empty={
            payload.city === null
              ? "Add a place to start a city."
              : "Nothing matches — clear filters."
          }
          onOpen={(place) => onOpenPlace?.(place)}
        />
      </section>
    </div>
  );
}
```

`src/components/city-switcher.tsx`:

```tsx
"use client";

export function CitySwitcher({
  cities,
  city,
  onChange,
}: {
  cities: { id: string; name: string; placeCount: number }[];
  city: { id: string; name: string } | null;
  onChange: (id: string) => void | Promise<void>;
}) {
  if (cities.length === 0) {
    return (
      <button type="button" disabled>
        City
      </button>
    );
  }
  return (
    <label className="text-sm font-semibold">
      <span className="sr-only">City</span>
      <select
        value={city?.id ?? ""}
        onChange={(e) => void onChange(e.target.value)}
      >
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
```

`src/components/filter-bar.tsx`:

```tsx
"use client";

export function FilterBar({
  query,
  onQuery,
  types,
  type,
  onType,
  areas,
  areaId,
  onArea,
  extraTags,
  extraTag,
  onExtraTag,
}: {
  query: string;
  onQuery: (q: string) => void;
  types: string[];
  type: string | null;
  onType: (t: string | null) => void;
  areas: { id: string; name: string }[];
  areaId: string | null;
  onArea: (id: string | null) => void;
  extraTags: string[];
  extraTag: string | null;
  onExtraTag: (t: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-2">
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search places"
        className="w-full rounded-full border border-stone-300 px-3 py-2"
      />
      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onType(type === t ? null : t)}
            className={type === t ? "font-semibold" : ""}
          >
            {t}
          </button>
        ))}
        {areas.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onArea(areaId === a.id ? null : a.id)}
          >
            {a.name}
          </button>
        ))}
        {extraTags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onExtraTag(extraTag === t ? null : t)}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
```

`src/components/place-list.tsx`:

```tsx
"use client";

import { haversineKm } from "@/lib/filters";
import type { BrowsePlace } from "@/lib/places-types";

export function PlaceList({
  places,
  origin,
  empty,
  onOpen,
}: {
  places: BrowsePlace[];
  origin: { lat: number; lng: number } | null;
  empty: string;
  onOpen: (place: BrowsePlace) => void;
}) {
  if (places.length === 0) return <p className="px-4 py-6 text-stone-500">{empty}</p>;
  return (
    <ul className="min-h-0 flex-1 overflow-auto">
      {places.map((place) => (
        <li key={place.id}>
          <button
            type="button"
            className="flex w-full gap-3 px-4 py-3 text-left"
            onClick={() => onOpen(place)}
          >
            {place.photoName ? (
              <img
                src={`/api/photos?name=${encodeURIComponent(place.photoName)}`}
                alt=""
                className="h-14 w-14 rounded-lg object-cover"
              />
            ) : (
              <div className="h-14 w-14 rounded-lg bg-stone-300" />
            )}
            <span>
              <span className="block font-medium">{place.name}</span>
              <span className="block text-sm text-stone-500">
                {[place.type, place.areaName, ...place.extraTags]
                  .filter(Boolean)
                  .join(" · ")}
                {origin
                  ? ` · ${haversineKm(origin, place).toFixed(1)} km`
                  : ""}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

`MapView`: wrap `@vis.gl/react-google-maps` `APIProvider` + `Map` + `AdvancedMarker` per place. `mapId` is not required if using a styles array via `styles={bopMapStyle}`. Center on `city.centerLat/centerLng` or `[39.8, -98.6]` when `city` is null. If `window.google` is missing after load error, render `null` for the map canvas (list remains). Catch script errors with an error boundary in `map-view.tsx` that returns `null`.

`src/app/error.tsx`:

```tsx
"use client";

export default function Error({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="p-6">
      <p>Couldn’t load places.</p>
      <button type="button" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
```

Keep last-good list in `BrowseApp` by not clearing `payload` on `onCityChange` failure — wrap the call in try/catch and keep prior state.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project jsdom src/components/browse-app.test.tsx`
Expected: PASS.

Also run: `npm test`
Expected: all existing tests still PASS.

- [ ] **Step 5: Commit**

```bash
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Add the city-scoped browse layout

* Filter list and map markers together from the city payload
* Show no-city and no-match empty states on the split-stack screen
EOF
git add src/app/page.tsx src/app/error.tsx src/components/browse-app.tsx src/components/browse-app.test.tsx src/components/place-list.tsx src/components/filter-bar.tsx src/components/map-view.tsx src/components/city-switcher.tsx src/lib/map-style.ts src/actions/browse.ts
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
