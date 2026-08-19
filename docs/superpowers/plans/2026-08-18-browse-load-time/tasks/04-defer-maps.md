> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 4: Defer Maps JS until after the shell

**Files:**
- Create: `src/components/map-canvas.tsx`
- Create: `src/components/map-view.test.tsx`
- Modify: `src/components/map-view.tsx`
- Test: `src/components/map-view.test.tsx`

**Interfaces:**
- Consumes: Current `MapView` / `MapCanvas` behavior in `src/components/map-view.tsx`; `pinAppearance` / `pinIconUrl` from `src/lib/map-pins.ts`; `bopMapStyle`; `MapSlotPlaceholder` from `src/components/browse-skeleton.tsx` if task 3 landed, otherwise an equivalent paper `div` with `data-testid="map-slot"`
- Produces: `map-view.tsx` does not import `@vis.gl/react-google-maps`. After hydrate it waits for `requestIdleCallback` (timeout fallback 1s, not 1ms) then `import("./map-canvas")`. Until then the reserved slot stays paper-colored. Failed Maps still leaves the list usable. Zoom pin behavior is unchanged.

Do not add clustering. Do not change `pinAppearance`. Do not block `BrowseApp` render on Maps.

If this task runs in parallel with task 3 and `MapSlotPlaceholder` does not exist yet, put a local paper `div` with `data-testid="map-slot"` and `className="h-full min-h-0 bg-[var(--paper)]"` in `map-view.tsx`. After both merge, switch the slot to `MapSlotPlaceholder`.

- [ ] **Step 1: Write the failing tests**

`src/components/map-view.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MapView } from "./map-view";
import type { BrowsePlace } from "@/lib/places-types";

vi.mock("./map-canvas", () => ({
  MapCanvas: () => <div data-testid="map-canvas" />,
}));

const place: BrowsePlace = {
  id: "p1",
  placeId: "ChIJ1",
  name: "Slant of Light Books",
  lat: 30.27,
  lng: -97.74,
  formattedAddress: "Austin",
  cityId: "c1",
  areaId: null,
  areaName: null,
  type: "book store",
  extraTags: [],
  notes: "",
  rating: 4.8,
  googleMapsUrl: "https://maps.google.com/?cid=1",
  photoName: null,
  authorAttributions: [],
  seedFeatureCid: null,
};

describe("MapView", () => {
  const idleCbs: Array<() => void> = [];

  beforeEach(() => {
    idleCbs.length = 0;
    vi.stubGlobal("requestIdleCallback", (cb: () => void) => {
      idleCbs.push(cb);
      return 1;
    });
    vi.stubGlobal("cancelIdleCallback", () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the reserved paper slot before Maps JS loads", () => {
    render(
      <MapView
        city={{ id: "c1", name: "Austin", centerLat: 30.27, centerLng: -97.74 }}
        places={[place]}
        markerIds={["p1"]}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByTestId("map-slot")).toBeInTheDocument();
    expect(screen.queryByTestId("map-canvas")).not.toBeInTheDocument();
  });

  it("loads the map canvas after idle", async () => {
    render(
      <MapView
        city={{ id: "c1", name: "Austin", centerLat: 30.27, centerLng: -97.74 }}
        places={[place]}
        markerIds={["p1"]}
        onSelect={() => {}}
      />,
    );
    expect(idleCbs).toHaveLength(1);
    idleCbs[0]!();
    await waitFor(() => {
      expect(screen.getByTestId("map-canvas")).toBeInTheDocument();
    });
  });
});
```

If Task 5 has not landed, keep `BrowsePlace` fields including `seedFeatureCid` as in this fixture. If Task 5 has landed, drop `seedFeatureCid` and type the fixture as `PlaceIndex` (omit `rating`, `googleMapsUrl`, `authorAttributions`).

Existing `browse-app.test.tsx` / `app-shell.test.tsx` already `vi.mock("./map-view")`. Do not break those mocks.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/map-view.test.tsx`

Expected: FAIL — map canvas is present immediately (static `@vis.gl` import) or `map-slot` is missing because `MapView` returns `null` while loading.

- [ ] **Step 3: Write minimal implementation**

Move the current `MapErrorBoundary`, `mapCenter`, `MapCanvas`, and `APIProvider` wrapper into `src/components/map-canvas.tsx`. That file is the only one that imports `@vis.gl/react-google-maps`. Copy the existing `MapCanvas` body verbatim, including `pinAppearance(zoom, selected)` and `Marker` `icon` / `zIndex`. Keep returning `null` from `MapCanvas` when `APILoadingStatus` is not `LOADED` (the **parent** slot is what stays paper-sized; the canvas may be empty until the API is ready).

Export:

```tsx
export function MapCanvas(props: {
  city: BrowsePayload["city"];
  places: BrowsePlace[];
  markerIds: string[];
  selectedPlaceId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element;
```

Wrap with `APIProvider` + `MapErrorBoundary` inside this module so `map-view.tsx` never touches `@vis.gl`.

`src/components/map-view.tsx`:

```tsx
"use client";

import { useEffect, useState, type ComponentType } from "react";
import { MapSlotPlaceholder } from "./browse-skeleton";
import type { BrowsePayload, BrowsePlace } from "@/lib/places-types";

type CanvasProps = {
  city: BrowsePayload["city"];
  places: BrowsePlace[];
  markerIds: string[];
  selectedPlaceId: string | null;
  onSelect: (id: string) => void;
};

function onIdle(cb: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(cb, { timeout: 1000 });
    return () => cancelIdleCallback(id);
  }
  const t = window.setTimeout(cb, 1000);
  return () => window.clearTimeout(t);
}

export function MapView({
  city,
  places,
  markerIds,
  selectedPlaceId = null,
  onSelect,
}: {
  city: BrowsePayload["city"];
  places: BrowsePlace[];
  markerIds: string[];
  selectedPlaceId?: string | null;
  onSelect: (id: string) => void;
}) {
  const [Canvas, setCanvas] = useState<ComponentType<CanvasProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stop = onIdle(() => {
      void import("./map-canvas").then((mod) => {
        if (!cancelled) setCanvas(() => mod.MapCanvas);
      });
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  if (!Canvas) {
    return <MapSlotPlaceholder />;
  }

  return (
    <div className="h-full w-full bg-[var(--paper)]">
      <Canvas
        city={city}
        places={places}
        markerIds={markerIds}
        selectedPlaceId={selectedPlaceId}
        onSelect={onSelect}
      />
    </div>
  );
}
```

If `browse-skeleton.tsx` is not present, inline:

```tsx
return <div data-testid="map-slot" className="h-full min-h-0 bg-[var(--paper)]" />;
```

`map-canvas.tsx` must keep: `key={city?.id ?? "none"}` on the Google `Map`; selected pin still uses `pinAppearance(zoom, true)` (ring). On `APIProvider` `onError` / error boundary, render the same paper slot (not a crash). The list in `BrowseApp` must still mount regardless.

Fallback timeout is **1000ms**, not `setTimeout(cb, 1)`, so tests that stub `requestIdleCallback` and never fire it stay on the placeholder.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/map-view.test.tsx src/components/browse-app.test.tsx src/components/app-shell.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/map-view.tsx src/components/map-canvas.tsx src/components/map-view.test.tsx
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Load Google Maps after the browse shell hydrates

* Keep a paper map slot sized by the browse grid
* Import `@vis.gl/react-google-maps` only after `requestIdleCallback`
EOF
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
