# Bop v1 — Implementation Plan

**Spec:** [2026-08-16-bop-design.md](../../specs/2026-08-16-bop-design.md)

## Required reading order

1. [overview.md](overview.md) — goal, architecture, file map, target interfaces
2. [global-constraints.md](global-constraints.md) — binding rules for every task
3. [deferred.md](deferred.md) — do not implement (controllers only)
4. Tasks in dependency order (see index). Implementers read only `overview.md`, `global-constraints.md`, and their own task file.

## Task index

| # | Title | Path | Depends on |
|---|---|---|---|
| 1 | Scaffold Next.js app and test harness | [tasks/01-scaffold.md](tasks/01-scaffold.md) | — |
| 2 | Drizzle schema and PGlite test database | [tasks/02-schema.md](tasks/02-schema.md) | 1 |
| 3 | Allowlist email check | [tasks/03-allowlist.md](tasks/03-allowlist.md) | 1 |
| 4 | City and area inference | [tasks/04-infer-location.md](tasks/04-infer-location.md) | 1 |
| 5 | Client-side place filters | [tasks/05-filters.md](tasks/05-filters.md) | 1 |
| 6 | Google Maps collection CSV parser | [tasks/06-csv-parse.md](tasks/06-csv-parse.md) | 1 |
| 7 | Shared place insert path | [tasks/07-place-insert.md](tasks/07-place-insert.md) | 2, 4 |
| 8 | Seed CLI and review report | [tasks/08-seed-cli.md](tasks/08-seed-cli.md) | 6, 7 |
| 9 | Better Auth, Google OAuth, allowlist gate | [tasks/09-auth-gate.md](tasks/09-auth-gate.md) | 2, 3 |
| 10 | Places client, add action, photo route | [tasks/10-places-add-photos.md](tasks/10-places-add-photos.md) | 7, 9 |
| 11 | Browse payload, preferences, settings, edits | [tasks/11-browse-settings.md](tasks/11-browse-settings.md) | 7, 9 |
| 12 | Browse UI: layout, map, list, chips, empty states | [tasks/12-ui-browse.md](tasks/12-ui-browse.md) | 11 |
| 13 | Add, detail, settings, and sign-in UI | [tasks/13-ui-add-detail.md](tasks/13-ui-add-detail.md) | 10, 11, 12 |

## Waves

- **Wave A:** Task 1, then Task 2.
- **Wave B (parallel after 1):** Tasks 3, 4, 5, 6.
- **Wave C:** Task 7 (after 2 + 4), then Task 8 (after 6 + 7).
- **Wave D (parallel after 2 + 3 + 7):** Task 9, then Tasks 10 and 11 in parallel after 9.
- **Wave E:** Task 12, then Task 13.

## Acceptance mapping

| Spec requirement | Task |
|---|---|
| Invite-only Google sign-in + allowlist (env ∪ table) | 3, 9, 13 |
| Not-invited screen; no place data | 9, 13 |
| City-scoped browse; last-used city or most places | 11, 12 |
| Infer city/area from Place Details; in-app vs seed fallback | 4, 7, 8 |
| Filters: text, type, area, extra tags; near-me sort | 5, 12 |
| Add via Autocomplete → Details → insert; duplicate opens existing | 7, 10, 13 |
| Move blocked when `place_id` exists in target city | 11 |
| Photo proxy; session required; attribution | 10, 13 |
| Seed: parse URL, exactly-one Text Search, report-only, both skip paths | 6, 8 |
| Settings invite/remove (env emails stay) | 11, 13 |
| Phone split-stack + desktop list/map; sheet vs panel | 12, 13 |
| Map script blocked → list still works | 12 |
| Shared notes last-write-wins; no city delete | 11 |

## Author self-review

- **Spec coverage:** Every v1 goal, data field, error path, and listed test has a task. Non-goals are in `deferred.md`.
- **Placeholder scan:** Task files use concrete types, commands, and code. No TBD / “handle edge cases” / “similar to Task N”. `createPlacesClient`, `getBrowsePayloadWithDeps`, and the main UI components are written out, not sketched.
- **Type consistency:** `PlaceDetails`, `PlacesPort`, `InsertPlaceInput`, `BrowsePayload`, and `SeedReport` are defined in `overview.md` and created in the task that first owns them (4, 7, 8, 11). Later tasks use those names unchanged. `BrowseApp` takes a controlled `payload` prop so Task 13’s `AppShell` can own list state after add/edit.
- **Spec leftovers covered in tasks:** last-city row (11), email normalize (3/9), Places API New + photo resource name (10), Vercel API-only server key (README operator asks + constraints), unique constraints (2), no city delete (13 settings), empty states (12), last-write-wins notes (11), exactly-one Text Search (8).

## Post-impl operator asks

After Task 13, a human must:

1. Provision Neon (Vercel Marketplace) and set `DATABASE_URL`.
2. Create a Google Cloud project: Maps JavaScript API (browser key, HTTP-referrer restricted) and Places API New (server key, API-restricted — not IP-restricted).
3. Create a Google OAuth client for Better Auth; set `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
4. Set `ALLOWED_EMAILS` to the first user’s Google email (trimmed, will be lowercased in code).
5. Run `npx drizzle-kit push` (or the migrate script from Task 2) against Neon.
6. Run `npx tsx scripts/seed.ts path/to/collection.csv` locally and read the report. Add skipped places in-app.
7. Deploy to Vercel; add the same env vars; set the browser key referrer to the production origin.
