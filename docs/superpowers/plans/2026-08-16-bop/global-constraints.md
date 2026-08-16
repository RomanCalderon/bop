> Part of [plan README](README.md).

> Every task in this plan implicitly includes these constraints.

## Global Constraints

- Browse and filter never call the Google Places API; they read Neon only.
- Places Autocomplete, Text Search, Details, and Photos run on the server. The server API key never ships to the browser.
- In-app add uses Autocomplete, not Text Search. Seed uses Text Search, not Autocomplete.
- Seed is a local CLI (`scripts/seed.ts`), not an HTTP route, admin UI, or in-app importer.
- V1 seed is report-only: no interactive picker and no resolution mapping file.
- Ambiguous and failed seed rows are never inserted. Users add skipped places later through in-app search.
- Seed city inference miss → failed, no insert. In-app city inference miss → save to the viewed city. A missing area never blocks either path.
- Persist `seed_feature_cid` only on a successful insert.
- Re-runs skip Text Search when `seed_feature_cid` is already stored. After resolve + city inference, reuse the row when `(place_id, city_id)` exists.
- `place_id` is unique per `city_id`, not globally.
- Allowlist is `ALLOWED_EMAILS` env ∪ `allowed_emails` table. Fail closed. Normalize emails by trim + lowercase.
- Env allowlist emails cannot be removed in-app.
- Photo route requires an allowlisted session. Store the Places photo resource name plus `authorAttributions`, not a hotlinked Google URL.
- Restrict the server Google key by allowed APIs only. Restrict the browser Maps key by HTTP referrer. Do not use IP restriction (Vercel egress is not stable).
- Persist `last_city_id` on `user_preferences`, not only in a cookie.
- City deletion is out of v1. Rename and place moves are in.
- Shared notes are last-write-wins. No version column.
- `"use client"` only on interactive leaves. Do not import `src/db`, `src/lib/places.ts`, `src/lib/auth.ts`, or `src/lib/seed.ts` into client components.
- No live Google calls in CI. Mock `PlacesPort` in tests.
- Commits use `~/.cursor/skills/commit/commit-no-trailer.sh`. Never `git commit`. Never `git add .`.
- Do not commit `.env`, `.env.local`, or secrets.
