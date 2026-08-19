# Bop v1 Implementation Plan

> Part of [plan README](README.md). Controllers start at README; implementers do not open it.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Bop — a phone-first, invite-only Next.js app where a small circle browses one shared, city-scoped list of saved places on a custom Google Map, with local filters and a one-time CLI seed from a Google Maps collection CSV.

**Architecture:** Neon Postgres holds every place. Browse and filter never call Google. In-app add uses server-side Places Autocomplete (New) + Place Details; the seed CLI uses Text Search + Details. Both call the same `insertPlace` function. City inference is a pre-insert gate: in-app falls back to the viewed city; seed records `city_inference_failed` and does not insert. Better Auth Google OAuth runs first; an allowlist (env ∪ table) fails closed. Photos are stored as Places resource names and proxied through a session-gated route.

**Tech Stack:** Next.js App Router (TypeScript, Tailwind), Drizzle + Neon (`neon-http` in prod, PGlite in tests), Better Auth, Google Maps JavaScript API + Places API (New), Vitest, Testing Library.

## File Map

| Path | Responsibility |
|---|---|
| `package.json` | Scripts: `dev`, `build`, `test`, `seed` |
| `vitest.config.ts` | Node + jsdom projects |
| `drizzle.config.ts` | Neon migrations |
| `.env.example` | All env names; no secrets |
| `src/db/schema.ts` | Drizzle tables + unique indexes |
| `src/db/index.ts` | Neon HTTP Drizzle client |
| `src/db/init.sql` | SQL applied by PGlite tests (must match schema) |
| `src/test/pglite.ts` | `createTestDb()` |
| `src/lib/places-types.ts` | Shared Places / insert / browse types |
| `src/lib/allowlist.ts` | Email normalize + env ∪ table check |
| `src/lib/infer-location.ts` | City / area / display type from address components |
| `src/lib/filters.ts` | Text / type / area / tag filter + distance sort |
| `src/lib/csv.ts` | Maps collection URL + CSV parse |
| `src/lib/place-insert.ts` | Shared insert + city resolution |
| `src/lib/seed.ts` | Seed runner + report |
| `src/lib/places.ts` | `PlacesPort` implementation (server-only) |
| `src/lib/auth.ts` | Better Auth server |
| `src/lib/auth-client.ts` | Better Auth React client |
| `src/lib/session.ts` | `getAllowedSession()` |
| `src/lib/require-allowed.ts` | Throw/redirect helpers for actions and routes |
| `src/actions/place-view.ts` | `toBrowsePlace` helper |
| `src/actions/places.ts` | Autocomplete, add, update, delete, move |
| `src/actions/browse.ts` | City browse payload + last city |
| `src/actions/settings.ts` | Invite / remove / list emails; rename city; create area |
| `src/app/api/auth/[...all]/route.ts` | Better Auth handler |
| `src/app/api/photos/route.ts` | Session-gated photo proxy |
| `src/app/layout.tsx` | Server shell |
| `src/app/page.tsx` | Server page: session + browse payload → `AppShell` |
| `src/app/error.tsx` | Inline retry when browse fails with no last-good list |
| `src/app/sign-in/page.tsx` | Sign-in |
| `src/app/not-invited/page.tsx` | Not invited |
| `src/app/settings/page.tsx` | Settings |
| `src/components/app-shell.tsx` | Client owner of selected place, add overlay, toast |
| `src/components/browse-app.tsx` | Filters, list, map, near-me, settings link |
| `src/components/filter-bar.tsx` | Search + type / area / tag chips |
| `src/components/place-list.tsx` | Place rows |
| `src/components/city-switcher.tsx` | City select; disabled when no cities |
| `src/components/place-detail.tsx` | Sheet (phone) / panel (desktop) |
| `src/components/add-place.tsx` | Autocomplete overlay |
| `src/components/map-view.tsx` | Google Map + markers; list works if script fails |
| `src/components/settings-form.tsx` | Invite / remove / rename |
| `src/components/sign-in-button.tsx` | Google OAuth button |
| `src/components/toast.tsx` | Failed-edit toast |
| `src/lib/map-style.ts` | Custom map style JSON |
| `scripts/seed.ts` | CLI entry: read CSV, write report file |
| `src/middleware.ts` | Redirect unauthenticated users to `/sign-in` |

## Design References

- Spec: `docs/superpowers/specs/2026-08-16-bop-design.md`
- Next.js: Server Components by default; `"use client"` only on interactive leaves; never import `src/db`, `src/lib/places.ts`, or `src/lib/auth.ts` into client components
- Places API (New): Autocomplete, Text Search, Details, Photos — server key, API-restricted
- Maps JavaScript API: browser key, HTTP-referrer restricted
- Commit: `~/.cursor/skills/commit/commit-no-trailer.sh` (never `git commit`)

## Target interfaces

### Places types — `src/lib/places-types.ts`

```ts
export type AddressComponent = {
  types: string[];
  longText: string;
};

export type PhotoAttribution = {
  displayName: string;
  uri: string | null;
};

export type PlaceDetails = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  formattedAddress: string;
  addressComponents: AddressComponent[];
  primaryType: string | null;
  rating: number | null;
  googleMapsUri: string;
  photoName: string | null;
  authorAttributions: PhotoAttribution[];
};

export type AutocompleteSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

export type TextSearchHit = {
  placeId: string;
  name: string;
  formattedAddress: string;
};

export type PlacesPort = {
  autocomplete(input: string): Promise<AutocompleteSuggestion[]>;
  textSearch(query: string): Promise<TextSearchHit[]>;
  getDetails(placeId: string): Promise<PlaceDetails | null>;
  fetchPhoto(
    photoName: string,
  ): Promise<{ bytes: Uint8Array; contentType: string } | null>;
};

export type CityPolicy =
  | { type: "in-app"; currentCityId: string }
  | { type: "seed" };

export type InsertPlaceInput = {
  details: PlaceDetails;
  notes: string;
  extraTags?: string[];
  seedFeatureCid?: string | null;
  cityPolicy: CityPolicy;
};

export type PlaceRow = {
  id: string;
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  formattedAddress: string;
  cityId: string;
  areaId: string | null;
  type: string | null;
  extraTags: string[];
  notes: string;
  rating: number | null;
  googleMapsUrl: string;
  photoName: string | null;
  authorAttributions: PhotoAttribution[];
  seedFeatureCid: string | null;
};

export type InsertPlaceResult =
  | { ok: true; place: PlaceRow; created: boolean }
  | { ok: false; reason: "city_inference_failed" };

export type BrowsePlace = PlaceRow & {
  areaName: string | null;
};

export type BrowsePayload = {
  city: {
    id: string;
    name: string;
    centerLat: number | null;
    centerLng: number | null;
  } | null;
  cities: { id: string; name: string; placeCount: number }[];
  places: BrowsePlace[];
  types: string[];
  areas: { id: string; name: string }[];
  extraTags: string[];
};
```

### Allowlist — `src/lib/allowlist.ts`

```ts
export function normalizeEmail(email: string): string;
export function parseAllowedEmailsEnv(envValue: string | undefined): string[];
export function isEmailAllowed(
  email: string,
  envList: string[],
  tableEmails: string[],
): boolean;
```

`normalizeEmail` trims and lowercases. Apply it to env values, table values, and the Google account email before comparison.

### Inference — `src/lib/infer-location.ts`

```ts
export function inferCityName(components: AddressComponent[]): string | null;
export function inferAreaName(components: AddressComponent[]): string | null;
export function displayType(primaryType: string | null): string | null;
```

- City: first `locality`, else first `administrative_area_level_1`. No match → `null`.
- Area: first `neighborhood`, else `sublocality`, else `sublocality_level_1`. No match → `null`.
- `displayType`: replace `_` with space (e.g. `book_store` → `book store`). `null` stays `null`.

### Filters — `src/lib/filters.ts`

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

export function filterPlaces<T extends PlaceFilterable>(
  places: T[],
  filters: PlaceFilters,
): T[];

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number;

export function sortByDistance<T extends { lat: number; lng: number }>(
  places: T[],
  origin: { lat: number; lng: number },
): T[];
```

Free-text matches (case-insensitive substring) against name, address, notes, type, and extra tags. Type / area / extra-tag chips are exact matches. Combined filters AND together.

### CSV — `src/lib/csv.ts`

```ts
export type CsvSeedRow = {
  note: string;
  url: string;
  name: string | null;
  featureCid: string | null;
};

export function parseMapsCollectionUrl(
  url: string,
): { name: string; featureCid: string } | null;

export function parseCollectionCsv(csvText: string): CsvSeedRow[];
```

URL pattern: `/place/<slug>/` plus `1s<featureId>:<cid>` in the `data=` segment. `featureCid` is stored as `"<featureId>:<cid>"` (the `1s` prefix stripped). Ignore `Tags` and `Comments` columns.

### Insert — `src/lib/place-insert.ts`

```ts
export async function insertPlace(
  db: BopDb,
  input: InsertPlaceInput,
): Promise<InsertPlaceResult>;
```

1. `inferCityName`. If null and `cityPolicy.type === "seed"` → `{ ok: false, reason: "city_inference_failed" }`. If null and in-app → use `currentCityId`.
2. Match existing city by `lower(name)` or insert a city (center = place lat/lng).
3. `inferAreaName`. If present, match or create area unique on `(city_id, lower(name))`. Missing area does not fail.
4. If `seedFeatureCid` is already stored → return that row, `created: false` (callers that want to skip Text Search should check CID first; insert still defends this).
5. If `(place_id, city_id)` exists → return existing row, `created: false`.
6. Else insert. Persist `seedFeatureCid` only on this successful insert.

`BopDb` is `PostgresJsDatabase<typeof schema>` / PGlite drizzle of the same schema. Use `import type { BopDb } from "@/db"`.

### Seed — `src/lib/seed.ts`

```ts
export type SeedReportEntry = {
  name: string | null;
  url: string;
  featureCid: string | null;
  note: string;
};

export type SeedReport = {
  resolved: (SeedReportEntry & { placeId: string; cityId: string; reused: boolean })[];
  ambiguous: (SeedReportEntry & { candidates: TextSearchHit[] })[];
  failed: (SeedReportEntry & { reason: string })[];
};

export async function seedCollection(opts: {
  db: BopDb;
  places: PlacesPort;
  csvText: string;
}): Promise<SeedReport>;
```

Per row: if `featureCid` is stored → `resolved` with `reused: true` and **do not** call `textSearch`. Else `textSearch(name)`. Exactly one hit → `getDetails` → `insertPlace` with `cityPolicy: { type: "seed" }` and `notes` from CSV Note. Zero / error / no city / no name → `failed`. Two or more → `ambiguous` with candidate `name`, `formattedAddress`, `placeId`. Never insert ambiguous or failed rows. No interactive picker. No mapping file.

### Session — `src/lib/session.ts`

```ts
export type AllowedUser = { id: string; email: string; name: string };

export async function getAllowedSession(): Promise<
  | { ok: true; user: AllowedUser }
  | { ok: false; reason: "unauthenticated" | "not_invited" }
>;
```

### Actions (return serializable objects; never throw to the client)

```ts
// src/actions/places.ts
export async function searchPlaces(input: string): Promise<
  | { ok: true; suggestions: AutocompleteSuggestion[] }
  | { ok: false; message: string }
>;

export async function addPlace(
  placeId: string,
  currentCityId: string | null,
): Promise<
  | { ok: true; place: BrowsePlace; created: boolean }
  | { ok: false; message: string }
>;

export async function updatePlace(
  id: string,
  patch: {
    notes?: string;
    extraTags?: string[];
    type?: string | null;
    areaId?: string | null;
    cityId?: string;
  },
): Promise<{ ok: true; place: BrowsePlace } | { ok: false; message: string }>;

export async function deletePlace(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }>;

export async function movePlace(
  id: string,
  toCityId: string,
): Promise<
  | { ok: true; place: BrowsePlace }
  | { ok: false; message: string; existingPlaceId?: string }
>;

// src/actions/browse.ts
export async function getBrowsePayload(
  cityId?: string | null,
): Promise<BrowsePayload>;

export async function setLastCity(
  cityId: string,
): Promise<{ ok: true } | { ok: false; message: string }>;

// src/actions/settings.ts
export async function listAllowedEmails(): Promise<{
  env: string[];
  table: string[];
}>;

export async function inviteEmail(
  email: string,
): Promise<{ ok: true } | { ok: false; message: string }>;

export async function removeAllowedEmail(
  email: string,
): Promise<{ ok: true } | { ok: false; message: string }>;

export async function renameCity(
  cityId: string,
  name: string,
): Promise<{ ok: true } | { ok: false; message: string }>;

export async function createArea(
  cityId: string,
  name: string,
): Promise<{ ok: true; area: { id: string; name: string } } | { ok: false; message: string }>;
```

`addPlace` with `currentCityId === null` and failed city inference returns `{ ok: false, message: "Couldn't save, try again." }` — there is no current city to fall back to.

`movePlace` if `(place.placeId, toCityId)` already exists: `{ ok: false, message: "Already saved in that city.", existingPlaceId }`.

Photo route: `GET /api/photos?name=` — `getAllowedSession` must be `ok`; else 401 (unauthenticated) or 403 (not invited). Then `places.fetchPhoto`.

### Unique constraints (schema)

- `places_place_id_city_id_uidx` on `(place_id, city_id)`
- `places_seed_feature_cid_uidx` unique on `seed_feature_cid` **where not null**
- `areas_city_name_uidx` unique on `(city_id, lower(name))`
- `cities_name_uidx` unique on `lower(name)`
- `allowed_emails_email_uidx` unique on `email` (store normalized)

### Empty states

- No cities: header city switcher disabled; map shows a neutral world/US center; list copy: “Add a place to start a city.”
- Filters match nothing: “Nothing matches — clear filters.”

### Commit helper (every task)

```bash
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Imperative summary

* Bullet with `file` names
EOF
git add <explicit paths from this task>
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```

Never `git commit`. Never `git add .`.
