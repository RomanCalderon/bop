> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 4: City and area inference

**Files:**
- Modify: `src/lib/places-types.ts` (add types listed below; keep existing `PhotoAttribution`)
- Create: `src/lib/infer-location.ts`
- Create: `src/lib/infer-location.test.ts`

**Interfaces:**
- Consumes: `PhotoAttribution` already in `src/lib/places-types.ts`
- Produces: full `places-types.ts` from overview.md (`AddressComponent`, `PlaceDetails`, `AutocompleteSuggestion`, `TextSearchHit`, `PlacesPort`, `CityPolicy`, `InsertPlaceInput`, `PlaceRow`, `InsertPlaceResult`, `BrowsePlace`, `BrowsePayload`); `inferCityName`, `inferAreaName`, `displayType`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/infer-location.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  displayType,
  inferAreaName,
  inferCityName,
} from "./infer-location";
import type { AddressComponent } from "./places-types";

function component(types: string[], longText: string): AddressComponent {
  return { types, longText };
}

describe("inferCityName", () => {
  it("prefers locality over administrative_area_level_1", () => {
    expect(
      inferCityName([
        component(["administrative_area_level_1"], "Texas"),
        component(["locality"], "Austin"),
      ]),
    ).toBe("Austin");
  });

  it("falls back to administrative_area_level_1", () => {
    expect(
      inferCityName([component(["administrative_area_level_1"], "Texas")]),
    ).toBe("Texas");
  });

  it("returns null when neither is present", () => {
    expect(
      inferCityName([component(["country"], "United States")]),
    ).toBeNull();
  });
});

describe("inferAreaName", () => {
  it("uses neighborhood, then sublocality, then sublocality_level_1", () => {
    expect(
      inferAreaName([
        component(["sublocality"], "South"),
        component(["neighborhood"], "Travis Heights"),
      ]),
    ).toBe("Travis Heights");
    expect(inferAreaName([component(["sublocality"], "South")])).toBe("South");
    expect(
      inferAreaName([component(["sublocality_level_1"], "Hyde Park")]),
    ).toBe("Hyde Park");
  });

  it("returns null when no area component exists", () => {
    expect(inferAreaName([component(["locality"], "Austin")])).toBeNull();
  });
});

describe("displayType", () => {
  it("replaces underscores with spaces", () => {
    expect(displayType("book_store")).toBe("book store");
  });

  it("returns null for null", () => {
    expect(displayType(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/infer-location.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write types and implementation**

Replace `src/lib/places-types.ts` with the full module from overview.md (keep `PhotoAttribution` fields identical: `displayName`, `uri: string | null`).

`src/lib/infer-location.ts`:

```ts
import type { AddressComponent } from "./places-types";

function firstOf(
  components: AddressComponent[],
  type: string,
): string | null {
  const hit = components.find((c) => c.types.includes(type));
  return hit?.longText ?? null;
}

export function inferCityName(
  components: AddressComponent[],
): string | null {
  return (
    firstOf(components, "locality") ??
    firstOf(components, "administrative_area_level_1")
  );
}

export function inferAreaName(
  components: AddressComponent[],
): string | null {
  return (
    firstOf(components, "neighborhood") ??
    firstOf(components, "sublocality") ??
    firstOf(components, "sublocality_level_1")
  );
}

export function displayType(primaryType: string | null): string | null {
  if (!primaryType) return null;
  return primaryType.replaceAll("_", " ");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/infer-location.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Add city and area inference from Place Details

* Prefer locality, then admin level 1, for city
* Prefer neighborhood, then sublocality fields, for area
EOF
git add src/lib/places-types.ts src/lib/infer-location.ts src/lib/infer-location.test.ts
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
