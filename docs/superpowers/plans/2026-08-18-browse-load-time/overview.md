# Browse load-time Implementation Plan

> Part of [plan README](README.md). Controllers start at README; implementers do not open it.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut time-to-first-byte and time-to-first-paint on `/` for a seeded city (~150 places) by collapsing the Neon HTTP waterfall, streaming paper chrome before place data, and deferring Google Maps JS — without changing AND-filter semantics or re-doing list windowing.

**Architecture:** `/` stays an App Router server page that gates on an allowlisted session, then streams a paper browse skeleton while `getBrowsePayloadWithDeps` loads. City fetch joins `areas` once (no per-place `toBrowsePlace`). The city index keeps every field `filterPlaces` searches, including `notes`; card-only fields load when a sheet opens. `AppShell` remains the client island. Maps JS enters after header + list hydrate, inside a reserved map slot. Settings loads city names without a full place payload.

**Tech Stack:** Next.js App Router (React 19 `cache()`, `loading.tsx`, `Suspense`), Drizzle + Neon HTTP (`neon-http` in prod, PGlite in tests), existing paper/ink/accent tokens in `src/app/globals.css`, `@vis.gl/react-google-maps` (deferred), Vitest + Testing Library.

## File Map

| Path | Responsibility |
|---|---|
| `src/lib/places-types.ts` | `PlaceIndex`, `PlaceCardFields`, `BrowsePlace`, `BrowsePayload` |
| `src/lib/session.ts` | `getAllowedSession` wrapped in React `cache()` |
| `src/lib/require-allowed.ts` | Unchanged throw helper; benefits from cached session |
| `src/actions/place-view.ts` | `toBrowsePlace` stays for add/update/move only |
| `src/actions/browse.ts` | Joined city fetch; skip prefs when `cityId` given; `listCitiesWithDeps`; `getPlaceCardWithDeps` |
| `src/actions/browse.test.ts` | N+1 guard, query-shape, card fetch, notes still on index |
| `src/app/(browse)/layout.tsx` | Session gate + redirect (no place queries) |
| `src/app/(browse)/page.tsx` | Cached session → `getBrowsePayloadWithDeps(db, userId, null)` → `AppShell` |
| `src/app/(browse)/loading.tsx` | Default export of `BrowseSkeleton` |
| `src/app/page.tsx` | **Deleted** after the move into `(browse)/` |
| `src/app/settings/page.tsx` | Cached session + `listCitiesWithDeps`; never `getBrowsePayload` |
| `src/components/browse-skeleton.tsx` | Paper skeleton: header, map slot, search, list rows |
| `src/components/browse-app.tsx` | City-switch pending; last-good list; no loading-as-empty |
| `src/components/app-shell.tsx` | Open sheet on index fields; `getPlaceCard` for card fields; post-add still uses full `BrowsePlace` |
| `src/components/place-detail.tsx` | Pending regions for rating / attribution / Maps URL |
| `src/components/place-list.tsx` | Still windowed; accepts `PlaceIndex[]` |
| `src/components/map-view.tsx` | Reserved slot; idle-load `map-canvas` |
| `src/components/map-canvas.tsx` | `APIProvider` + current `MapCanvas` / `Marker` / `pinAppearance` |
| `src/components/map-view.test.tsx` | Slot before Maps; pins after idle |
| `src/lib/filters.ts` | Unchanged haystack (name, address, notes, type, area, tags) |
| `src/lib/map-pins.ts` | Unchanged; no clustering |

## Design References

- Product + filter semantics: `docs/superpowers/specs/2026-08-16-bop-design.md`
- Visual polish (phone 40vh map / desktop 28rem list; **no cluster bubbles**): `docs/superpowers/specs/2026-08-17-bop-ui-polish.md`
- Prior plan constraints: `docs/superpowers/plans/2026-08-16-bop/global-constraints.md`
- Tokens: `src/app/globals.css` (`--paper`, `--ink`, `--accent`, `--sheet`, `--muted`)
- Next.js: Server Components by default; `"use client"` only on interactive leaves; `loading.tsx` wraps the **page** of its segment, not the layout. Put the session gate in `(browse)/layout.tsx` so unauthenticated users redirect without a browse skeleton, and the skeleton covers place-data wait only.
- Commit: `~/.cursor/skills/commit/commit-no-trailer.sh` (never `git commit`)

## Locked design decisions

### Search fields stay on the city index

`filterPlaces` (`src/lib/filters.ts`) searches `name`, `formattedAddress`, `notes`, `type`, `areaName`, `extraTags`. The design spec requires notes in search. Client-side AND filters on the current city must stay instant.

**Do this:** `BrowsePayload.places` is `PlaceIndex[]`. `PlaceIndex` includes `notes`, address, type, area, tags, lat/lng, `photoName`.

**Do not do this:** defer `notes` (search would miss until open). Do not naive-page `places[]` as the primary load-time fix.

### Card fields are deferred

Dropped from the city index (and never sent as `seedFeatureCid`):

- `authorAttributions`
- `googleMapsUrl`
- `rating`
- `seedFeatureCid` (client never needed it)

Fetched by `getPlaceCard` when the user opens a place that is only a `PlaceIndex`. Add/update/move already return a full `BrowsePlace`; the sheet must open immediately with that object and must not refetch.

### Neon HTTP stays

Do not switch off `drizzle-orm/neon-http` in this plan. After tasks 1–2 a city load should be **~4–5** Neon round trips (session + allowlist + cities/counts + optional prefs + places⋈areas), not ~N+6.

### Current query shape (today — for implementers)

`src/app/page.tsx` calls `getAllowedSession()` then `getBrowsePayload()` → `requireAllowedSession()` → `getAllowedSession()` again. `getBrowsePayloadWithDeps` then: cities+counts, prefs, `select *` places, `select` city areas, **`toBrowsePlace` per row** (extra `areas` lookup when `areaId` is set). Driver is Neon HTTP; each query is a round trip.

## Target interfaces

### Types — `src/lib/places-types.ts`

Keep `PlaceRow` as the full DB row (insert path, `toPlaceRow`). Add index/card split for browse:

```ts
/** City-index row: list, pins, and AND-filters (including notes search). */
export type PlaceIndex = {
  id: string;
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  formattedAddress: string;
  cityId: string;
  areaId: string | null;
  areaName: string | null;
  type: string | null;
  extraTags: string[];
  notes: string;
  photoName: string | null;
};

export type PlaceCardFields = {
  rating: number | null;
  googleMapsUrl: string;
  authorAttributions: PhotoAttribution[];
};

/** Full row: mutations (add/update/move) and getPlaceCard. */
export type BrowsePlace = PlaceIndex & PlaceCardFields;

export type BrowsePayload = {
  city: {
    id: string;
    name: string;
    centerLat: number | null;
    centerLng: number | null;
  } | null;
  cities: { id: string; name: string; placeCount: number }[];
  places: PlaceIndex[];
  types: string[];
  areas: { id: string; name: string }[];
  extraTags: string[];
};

export function hasCardFields(
  place: PlaceIndex | BrowsePlace,
): place is BrowsePlace {
  return "googleMapsUrl" in place && "authorAttributions" in place;
}
```

`PlaceRow` keeps `seedFeatureCid`. It is not part of `PlaceIndex` or `BrowsePlace`.

### Browse actions — `src/actions/browse.ts`

```ts
export async function getBrowsePayloadWithDeps(
  database: BopDb,
  userId: string,
  cityId: string | null,
): Promise<BrowsePayload>;

export async function listCitiesWithDeps(
  database: BopDb,
): Promise<{ id: string; name: string }[]>;

export async function getPlaceCardWithDeps(
  database: BopDb,
  placeId: string,
): Promise<BrowsePlace | null>;

export async function getPlaceCard(placeId: string): Promise<BrowsePlace | null>;

export async function changeCity(
  cityId: string,
): Promise<BrowsePayload | { ok: false; message: string }>;
```

`getBrowsePayloadWithDeps` must:

1. Load cities + place counts (one query).
2. If `cityId` is missing or not in that list, load `user_preferences` and pick last city or most-places. If `cityId` matches, **do not** query `user_preferences`.
3. Load that city’s places with `leftJoin(areas, eq(places.areaId, areas.id))` in **one** query. Map `areaName` from the join. **Do not** call `toBrowsePlace`.
4. Derive `types`, `extraTags`, and `areas` from the joined rows (no second `areas` table scan required).
5. After task 5, select only `PlaceIndex` columns (not `rating`, `googleMapsUrl`, `authorAttributions`, `seedFeatureCid`).

`toBrowsePlace(db, place)` remains in `src/actions/place-view.ts` for single-row add/update/move.

### Session

```ts
// src/lib/session.ts
import { cache } from "react";

export const getAllowedSession = cache(async (): Promise<
  | { ok: true; user: AllowedUser }
  | { ok: false; reason: "unauthenticated" | "not_invited" }
> => { /* existing body */ });
```

`(browse)/layout.tsx` and `(browse)/page.tsx` both call `getAllowedSession`; the second call must not hit Better Auth or `allowed_emails` again.

### AppShell

```ts
export type AppShellActions = {
  initial: BrowsePayload;
  onCityChange: (cityId: string) => Promise<CityChangeResult>;
  getPlaceCard: (placeId: string) => Promise<BrowsePlace | null>;
  // existing searchPlaces, addPlace, updatePlace, deletePlace, movePlace, createArea
};
```

### Loading UI contract

- First paint of `/` (after session) shows `BrowseSkeleton`: same grid as `BrowseApp` (phone `grid-rows-[auto_40vh_auto_minmax(0,1fr)]`, desktop `md:grid-cols-[28rem_minmax(0,1fr)]`).
- Colors from `--paper` / `--ink` / `--accent` / `--sheet` / `--muted` only. No `bg-gray-*`, `bg-zinc-*`, or `bg-stone-*` on the skeleton.
- `role="status"`, `aria-live="polite"`, `aria-busy="true"`, `aria-label="Loading places"`.
- Must not render “Add a place to start a city.” or “No saved place matches this search.”
- `animate-pulse` plus `motion-reduce:animate-none`.
- Map JS is not a gate on visibility. Until idle + `@vis.gl` chunk, the map slot is paper-colored and sized (`h-full min-h-0`, phone ~40vh via the parent grid).
- City switch: keep last-good `places` in the list/map; set `aria-busy` on the places section and map slot; select value may show the pending city id. True empty states only when not pending.

### Query budget (city load on `/`)

| Step | Queries |
|---|---|
| `getAllowedSession` (layout + page, cached) | Better Auth session + `allowed_emails` (once) |
| cities + `count(places.id)` | 1 |
| `user_preferences` (only if no valid `cityId`) | 0 or 1 |
| places ⋈ areas for that city | 1 |
| **Total Neon after session** | **2–3** (was N+4) |
