# Bop — Design Spec

**Date:** 2026-08-16  
**Status:** Approved for implementation planning

Bop is a phone-first web app for a small circle to search, filter, and browse a shared list of saved places on a map. It exists because Google Maps collections cannot filter or search saved locations well.

Tagline: *For when you are bopping around town from place to place.*

## Goals

- Browse one shared list as a city-scoped map plus an always-visible, filterable list.
- Filter by free-text, **type** (restaurant, bar, bookstore, …), **area**, and extra **tags**.
- Add places by searching Google Places (in-app) and by a one-time CSV seed from a Google Maps collection.
- Stay minimal and simple, but visually considered (custom-styled map, not a default embed).

## Non-goals (v1)

- User-uploaded photos
- In-app CSV import or export
- Per-user lists, public browse, or open signup
- Manual place entry (name/address form) or paste-a-Maps-link as a first-class add path
- Visited/unvisited, price, hours, or “open now”
- Mapbox / MapLibre, Supabase, or a second map vendor
- Visual regression or live Google API tests in CI

## Users and access

- One shared list. Anyone invited can add, edit, tag, move, and delete places, and can invite more emails.
- Invite-only: Google sign-in via Better Auth, then an allowlist check on email.
- Allowlist = `ALLOWED_EMAILS` env (comma-separated, always honored) **plus** rows in `allowed_emails`. Env is how the first person gets in; Settings manages the table after that.
- Unknown emails see a “not invited” screen. No place data is shown.
- Settings: add/remove table emails (env emails cannot be removed in-app). Inviting an email that is already allowed is a no-op.

## Experience

### Layout

- **Phone (primary):** split stack — city header, map on top, search + filter chips between, list always visible below.
- **Desktop:** filters + list on the left, map on the right. Place detail is a side panel (not a sheet).
- Header: city switcher, near-me, **+** to add. Settings is reachable from the header (account / overflow), not a third pane on the main screen.

### City scope

- Cities are first-class. Switching city swaps the place set, area list, and map center.
- On first load after sign-in: last-used city, or the city with the most places if none is stored.
- On save, infer city from Place Details address components (`locality`, else `administrative_area_level_1`). Match an existing city name (case-insensitive) or create one. The user can create/rename cities and move places between them.
- If inference fails, save into the city currently being viewed and leave city/area editable. Never drop the save.

### Filters

All filters apply to both list and map markers.

| Control | Source | Behavior |
|---|---|---|
| Search | Name, address, notes, type, extra tags | Free text |
| Type | Places primary type, user-overridable | Chips = distinct types on places **in the current city** (restaurant, bar, bookstore, …). Not mixed into extra tags. |
| Area | Address components, user-overridable | Infer from Place Details `neighborhood` / `sublocality` / `sublocality_level_1`, in that order. If none, area is unset until the user picks or creates one. Chips are areas in the current city. |
| Extra tags | User-added freeform | Chips; suggestions from tags already in use. |
| Near me | Browser geolocation | Sorts/highlights by distance. If permission is denied, hide the control; default list order remains. |

### Place list and detail

List row: cover photo, name, type, extra tags, area, distance (when near-me is on).

Place sheet (phone) / panel (desktop), from a row or a pin:

- Cover photo (Places), name, type, area, rating, extra tags
- Shared notes (editable by anyone invited)
- Open in Google Maps
- Edit (notes, extra tags, type override, area, city)

### Add place

1. **+** opens a search overlay using Places **Autocomplete** (as-you-type), not Text Search.
2. User picks a result.
3. Server fetches Place Details (coords, address, city, area, type, rating, photo identifier, Maps URL) and inserts via the same path as seed.
4. If that Google `place_id` already exists **in the current city**, open the existing record — do not insert a second row.
5. Moving a place into a city that already has that `place_id` is blocked; open the existing row in the target city instead.

No manual-entry fallback in v1.

## Data

### Place record

Stored in Neon so browse/filter never calls Google:

- Google `place_id` — unique with `city_id` (`place_id` + `city_id`)
- Name, lat/lng, formatted address
- City id, area id (nullable until set)
- Type — Places primary type at insert; user-overridable; this is the filterable type
- Extra tags (list of strings)
- Shared notes
- Rating (number, from Places at insert)
- Google Maps URL
- Photo identifier from Place Details (reference or resource name; not a hotlinked Google URL)
- Seed feature-id + CID when the row came from CSV (see Seed); unique when present so re-runs skip

### Other records

- `allowed_emails`
- `cities` (name, optional default center)
- `areas` (name, city id)
- Auth tables from Better Auth
- Per-user `last_city_id` (session or a small preference row)

### Photos

- Store the photo identifier from Place Details only.
- App photo route requires a session, fetches the image server-side, so the server API key never ships to the browser.
- Show Google attribution on the place sheet.

## Architecture

- **App:** Next.js App Router, TypeScript, Tailwind, deployed to Vercel.
- **DB:** Neon Postgres via Drizzle. Server Actions / route handlers only.
- **Auth:** Better Auth + Google OAuth. Allowlist after sign-in.
- **Maps:** Google Maps JavaScript API with a custom style. Browser key restricted by HTTP referrer.
- **Places:** Autocomplete (in-app add), Text Search (seed only), Place Details, and Photos — all from the server. Server key restricted by IP / API restriction.
- **Seed:** local CLI script, not an HTTP route.

## Seed (one-time CLI)

Not a product feature. Run locally against Neon.

Google Maps collection CSV columns: **Note**, **URL**, **Tags**, **Comments**.

- **Tags** and **Comments** are empty on every row — ignore them.
- **Note** → shared notes on the place.
- **URL** shape:

  `https://www.google.com/maps/place/Slant+of+Light+Books/data=!4m2!3m1!1s0x880fd33c9f9f050f:0x8f7f4b4cc0c22510`

  There is no address, lat/lng, city, or `ChIJ…` place id. The path slug is the name. The `1s0x…:0x…` pair is a **feature id + CID**. It is unique in the export but **Places API does not accept it as `place_id`**.

Per row:

1. Parse name from `/place/…/` and persist the feature-id/CID pair.
2. Places Text Search by name.
3. If Text Search returns **exactly one** result → Place Details → same insert path as in-app add → attach Note.
4. If two or more hits → **ambiguous**: log for pick/skip, **do not insert**.
5. If zero hits, custom pin, or API error → **failed**: log, do not insert.

The script writes a review report: **resolved / ambiguous / failed**. That report is the review surface (pick or skip ambiguous rows). Re-runs skip rows whose feature-id/CID or resolved `place_id` is already stored.

Name-only search can collide; custom pins may not resolve. That is expected and must stay visible in the report.

## Data flow

1. **Sign-in** → Google OAuth → session → allowlist. Fail closed.
2. **Browse** → server returns that city’s places (and its types, areas, extra tags). Filter/search/near-me run on the client against that payload.
3. **Add** → Places on the server → insert (or open duplicate).
4. **Edit** → write notes, extra tags, type, area, city to Neon. Photo, rating, and Maps URL stay as imported unless explicitly re-fetched later (not v1).
5. **Invite** → insert allowlist email. Next Google sign-in with that email succeeds.

## Error handling

- Google cancel/failure → stay on sign-in with a short retry.
- Not allowlisted → “not invited” only.
- Places down, quota, empty, or timeout (one retry) → “Couldn’t find that — try a more specific name.”
- Details fail after pick → do not save a half-row; “Couldn’t save, try again.”
- Duplicate place id in city → open existing.
- City/area inference miss → save to current city; fields stay editable.
- Browse/server error → last good list if present, else inline retry.
- Photo fail → placeholder; place remains usable.
- Geolocation denied → hide near-me.
- Map script blocked → list + filters still work.
- Failed edit → toast; field stays dirty.
- Seed: every row is resolved, ambiguous, or failed; ambiguous/failed never auto-insert.

## Testing

**Unit:** CSV URL parser (slug + feature-id/CID); city/area inference from Place Details address components; filter/search over a fixture (text, type, area, extra tags, combined); duplicate place id in a city; allowlist check (env ∪ table).

**Seed:** fixture CSV with one clean resolve, one ambiguous name, one miss/custom pin, one Note that must persist, empty Tags/Comments ignored. Assert report buckets and that ambiguous/failed rows are not inserted. Re-run → no duplicate inserts.

**API:** mocked Autocomplete + Details → persisted row. Duplicate `place_id` in city → existing row. Unallowlisted session → 403 on place and photo routes. Photo route requires a session.

**UI:** chips update list and markers together; city switch changes set and recenters; sheet/panel opens from row and pin; add overlay pick → row appears; sign-in and not-invited screens.

**Out of scope:** live Google calls in CI, visual regression, load tests.

## Implementation notes

- Prefer small modules: CSV parse, Places client, place insert, filters, allowlist — each with a clear input/output.
- Google Places and Maps billing and photo attribution are production constraints; keep browse off the Places API.
- `.superpowers/` is local brainstorm output and must stay out of git.
