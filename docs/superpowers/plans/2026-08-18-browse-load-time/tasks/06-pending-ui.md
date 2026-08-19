> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 6: City-switch and place-sheet pending states

**Files:**
- Modify: `src/components/browse-app.tsx`
- Modify: `src/components/browse-app.test.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/components/app-shell.test.tsx`
- Modify: `src/components/place-detail.tsx`
- Create: `src/components/place-detail.test.tsx` (if no existing file)
- Test: `src/components/browse-app.test.tsx`, `src/components/app-shell.test.tsx`, `src/components/place-detail.test.tsx`

**Interfaces:**
- Consumes: Task 3 `PlaceListSkeleton`; Task 4 reserved map slot; Task 5 `PlaceIndex`, `BrowsePlace`, `hasCardFields`, `getPlaceCard`
- Produces: City switch keeps last-good list/map visible with `aria-busy`; select may show the pending city id. Opening a `PlaceIndex` shows the sheet immediately (name, photo, type, area, tags, notes) with pending rating / attribution / Maps URL. Opening a full `BrowsePlace` from add/update does not call `getPlaceCard`. True empty states only when not pending.

Do not flash “Add a place to start a city.” while a city payload is in flight. Do not block the sheet on the extra fetch. List windowing and lazy photos stay.

- [ ] **Step 1: Write the failing tests**

`src/components/browse-app.test.tsx` — add (payload fixtures already in the file; add a Chicago payload):

```tsx
  it("keeps the current list visible while the next city payload is in flight", async () => {
    const user = userEvent.setup();
    let resolveCity: (value: BrowsePayload) => void = () => {};
    const pending = new Promise<BrowsePayload>((resolve) => {
      resolveCity = resolve;
    });
    const chicago: BrowsePayload = {
      city: { id: "c2", name: "Chicago", centerLat: 41.8, centerLng: -87.6 },
      cities: payload.cities,
      types: ["bar"],
      areas: [],
      extraTags: [],
      places: [
        {
          id: "p-chi",
          placeId: "ChIJ-chi",
          name: "The Violet Hour",
          lat: 41.9,
          lng: -87.68,
          formattedAddress: "Chicago",
          cityId: "c2",
          areaId: null,
          areaName: null,
          type: "bar",
          extraTags: [],
          notes: "",
          photoName: null,
        },
      ],
    };
    render(
      <BrowseApp
        payload={payload}
        onCityChange={() => pending}
      />,
    );
    await user.selectOptions(screen.getByLabelText("City"), "c2");
    expect(screen.getByText("Slant of Light Books")).toBeInTheDocument();
    expect(screen.queryByText("Add a place to start a city.")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Places" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("City")).toHaveValue("c2");
    resolveCity(chicago);
    expect(await screen.findByText("The Violet Hour")).toBeInTheDocument();
    expect(screen.queryByText("Slant of Light Books")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Places" })).not.toHaveAttribute("aria-busy");
  });
```

Strip card-only fields from `payload.places` if task 5 already did; otherwise keep the existing fixture shape.

`src/components/place-detail.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlaceDetail } from "./place-detail";
import type { PlaceIndex, BrowsePlace } from "@/lib/places-types";

const indexPlace: PlaceIndex = {
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
  extraTags: ["quiet"],
  notes: "Go on a weekday",
  photoName: "places/ChIJ1/photos/AAA",
};

const fullPlace: BrowsePlace = {
  ...indexPlace,
  rating: 4.8,
  googleMapsUrl: "https://maps.google.com/?cid=1",
  authorAttributions: [{ displayName: "Ada", uri: null }],
};

const noop = {
  cities: [{ id: "c1", name: "Austin" }],
  areas: [{ id: "east", name: "East" }],
  updatePlace: async () => ({ ok: true as const, place: fullPlace }),
  deletePlace: async () => ({ ok: true as const }),
  movePlace: async () => ({ ok: true as const, place: fullPlace }),
  createArea: async () => ({ ok: true as const, area: { id: "east", name: "East" } }),
  onClose: () => {},
  onChanged: () => {},
  onDeleted: () => {},
  onError: () => {},
};

describe("PlaceDetail", () => {
  it("opens immediately on index fields and marks card extras pending", () => {
    render(
      <PlaceDetail
        {...noop}
        place={indexPlace}
        cardStatus="pending"
      />,
    );
    expect(screen.getByRole("heading", { name: "Slant of Light Books" })).toBeInTheDocument();
    expect(screen.getByText("Go on a weekday")).toBeInTheDocument();
    expect(screen.getByText("quiet")).toBeInTheDocument();
    expect(screen.queryByText("Photo: Ada")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in Google Maps" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByRole("link", { name: "Open in Google Maps" })).not.toBeInTheDocument();
  });

  it("shows attribution and maps link when card fields are ready", () => {
    render(
      <PlaceDetail
        {...noop}
        place={fullPlace}
        cardStatus="ready"
      />,
    );
    expect(screen.getByText("Photo: Ada")).toBeInTheDocument();
    expect(screen.getByText(/4\.8/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Google Maps" })).toHaveAttribute(
      "href",
      "https://maps.google.com/?cid=1",
    );
  });
});
```

`src/components/app-shell.test.tsx` — add (keep the existing add-place test that proves post-add open still works):

```tsx
  it("opens the sheet from a list row before card fields return", async () => {
    const user = userEvent.setup();
    const indexOnly = {
      id: place.id,
      placeId: place.placeId,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      formattedAddress: place.formattedAddress,
      cityId: place.cityId,
      areaId: place.areaId,
      areaName: place.areaName,
      type: place.type,
      extraTags: place.extraTags,
      notes: place.notes,
      photoName: place.photoName,
    };
    const initial = { ...payload, places: [indexOnly] };
    let resolveCard: (value: BrowsePlace) => void = () => {};
    const cardPromise = new Promise<BrowsePlace>((resolve) => {
      resolveCard = resolve;
    });
    const getPlaceCard = vi.fn(() => cardPromise);
    render(
      <AppShell
        initial={initial}
        onCityChange={async () => initial}
        getPlaceCard={getPlaceCard}
        searchPlaces={async () => ({ ok: true, suggestions: [] })}
        addPlace={async () => ({ ok: true, place, created: true })}
        updatePlace={async () => ({ ok: true, place })}
        deletePlace={async () => ({ ok: true })}
        movePlace={async () => ({ ok: true, place })}
        createArea={async () => ({ ok: true, area: { id: "east", name: "East" } })}
      />,
    );
    await user.click(screen.getByText("Slant of Light Books"));
    expect(screen.getByRole("heading", { name: "Slant of Light Books" })).toBeInTheDocument();
    expect(getPlaceCard).toHaveBeenCalledWith("p1");
    expect(screen.getByRole("button", { name: "Open in Google Maps" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    resolveCard(place);
    expect(await screen.findByText("Photo: Ada")).toBeInTheDocument();
  });

  it("does not refetch card fields after add already returned a full place", async () => {
    const user = userEvent.setup();
    const getPlaceCard = vi.fn(async () => place);
    const added: BrowsePlace = { ...place, id: "p2", name: "New Cafe", type: "cafe" };
    render(
      <AppShell
        initial={payload}
        onCityChange={async () => payload}
        getPlaceCard={getPlaceCard}
        searchPlaces={async () => ({
          ok: true,
          suggestions: [
            { placeId: "ChIJ-new", primaryText: "New Cafe", secondaryText: "Austin, TX" },
          ],
        })}
        addPlace={async () => ({ ok: true, place: added, created: true })}
        updatePlace={async () => ({ ok: true, place })}
        deletePlace={async () => ({ ok: true })}
        movePlace={async () => ({ ok: true, place })}
        createArea={async () => ({ ok: true, area: { id: "east", name: "East" } })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Add place" }));
    await user.type(screen.getByPlaceholderText("Search Google places"), "cafe");
    await user.click(screen.getByRole("button", { name: /New Cafe/ }));
    expect(
      await screen.findByRole("heading", { name: "New Cafe" }),
    ).toBeInTheDocument();
    expect(getPlaceCard).not.toHaveBeenCalled();
  });
```

The existing “adds a place from the overlay and opens its details card” test must keep passing. Give every `AppShell` render in this file `getPlaceCard={async () => place}` if task 5 required the prop.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/browse-app.test.tsx src/components/place-detail.test.tsx src/components/app-shell.test.tsx`

Expected: FAIL — list clears or empty-state flashes on city switch; sheet requires `googleMapsUrl`; add path calls `getPlaceCard` or the new tests cannot compile.

- [ ] **Step 3: Write minimal implementation**

`src/components/browse-app.tsx`:

- Add `const [pendingCityId, setPendingCityId] = useState<string | null>(null)`.
- `handleCityChange`: `setPendingCityId(id)` first, then `await onCityChange(id)`, then `setCurrent(next)`, then `setPendingCityId(null)`. On catch, `setPendingCityId(null)` and keep last-good `current`.
- CitySwitcher: `city={pendingCityId ? { id: pendingCityId, name: current.cities.find((c) => c.id === pendingCityId)?.name ?? current.city?.name ?? "" } : current.city}` so the select does not snap back.
- Places `<section>`: add `aria-busy={pendingCityId ? true : undefined}`.
- `empty` passed to `PlaceList`: if `pendingCityId`, pass `<PlaceListSkeleton />` (never `EmptyCity` / `NoMatchEmpty` while pending). If not pending, keep existing empty states.
- Map wrapper: `aria-busy={pendingCityId ? true : undefined}` on the map pane `div`.

`src/components/place-detail.tsx`:

- Widen `place` to `PlaceIndex | BrowsePlace`.
- Add `cardStatus: "pending" | "ready"`.
- Attribution: only if `hasCardFields(place) && place.authorAttributions.length`.
- Rating in the meta line: only if `hasCardFields(place) && place.rating != null`.
- Maps control: if `cardStatus === "pending"` or missing `googleMapsUrl`, render `<button type="button" aria-busy="true" aria-label="Open in Google Maps" className={...same styles as the link...} disabled>` — not an `<a>` with an empty href. If ready, keep `<a href={place.googleMapsUrl} ...>Open in Google Maps</a>`.
- Edit/save/delete still use `place.id` and existing actions (those return full `BrowsePlace`).

`src/components/app-shell.tsx`:

```ts
const [selected, setSelected] = useState<PlaceIndex | BrowsePlace | null>(null);
const [cardStatus, setCardStatus] = useState<"pending" | "ready">("ready");

function openPlace(place: PlaceIndex | BrowsePlace) {
  setSelected(place);
  if (hasCardFields(place)) {
    setCardStatus("ready");
    return;
  }
  setCardStatus("pending");
  void props.getPlaceCard(place.id).then((card) => {
    if (!card) {
      setCardStatus("ready");
      return;
    }
    setSelected(card);
    setCardStatus("ready");
    upsertPlace(card);
  });
}
```

Pass `onOpenPlace={openPlace}` to `BrowseApp`. `handleSaved` / `handleChanged` keep `setSelected(place)` on a full `BrowsePlace` and `setCardStatus("ready")` — they must not call `getPlaceCard`.

`<PlaceDetail place={selected} cardStatus={cardStatus} ... />`.

`upsertPlace` should accept `PlaceIndex | BrowsePlace`. When merging a full card into `payload.places`, store the index fields (card extras may sit on the object; `BrowsePayload.places` is `PlaceIndex[]`, extra keys at runtime are harmless). Prefer mapping to `PlaceIndex` when writing to `payload.places` so the in-memory index stays slim:

```ts
function toIndex(place: PlaceIndex | BrowsePlace): PlaceIndex {
  return {
    id: place.id,
    placeId: place.placeId,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    formattedAddress: place.formattedAddress,
    cityId: place.cityId,
    areaId: place.areaId,
    areaName: place.areaName,
    type: place.type,
    extraTags: place.extraTags,
    notes: place.notes,
    photoName: place.photoName,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/browse-app.test.tsx src/components/place-detail.test.tsx src/components/app-shell.test.tsx src/components/place-list.test.tsx`

Expected: PASS. Then `npm test && npm run typecheck && npm run lint`.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/browse-app.tsx src/components/browse-app.test.tsx src/components/app-shell.tsx src/components/app-shell.test.tsx src/components/place-detail.tsx src/components/place-detail.test.tsx
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Show pending browse and sheet states without empty flashes

* Keep last-good city list visible while `changeCity` runs
* Open the place sheet on index fields; fill Maps/attribution when the card returns
EOF
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
