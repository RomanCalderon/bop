> Part of [plan README](README.md).

> Every task in this plan implicitly includes these constraints.

## Global Constraints

- Browse and filter never call the Google Places API; they read Neon only.
- Places Autocomplete, Text Search, Details, and Photos run on the server. The server API key never ships to the browser.
- `"use client"` only on interactive leaves. Do not import `src/db`, `src/lib/places.ts`, `src/lib/auth.ts`, or `src/lib/seed.ts` into client components.
- No live Google calls in CI. Mock `PlacesPort` and `@vis.gl/react-google-maps`.
- Commits use `~/.cursor/skills/commit/commit-no-trailer.sh`. Never `git commit`. Never `git add .`.
- Do not commit `.env`, `.env.local`, or secrets.
- Filter semantics stay AND; type/area/tag remain single-select. Search haystack stays name, address, notes, type, area name, extra tags.
- Client-side AND filters on the current city stay instant (full city index in memory).
- Phone-first layout and custom paper map stay (map ~40vh on phone; list ~28rem on desktop).
- Do not replace the Neon HTTP driver (`src/db/index.ts`, `drizzle-orm/neon-http`) unless a later investigation proves query count is already low and latency is still the driver — that investigation is not this plan.
- Do not add map clustering or numbered cluster bubbles. Do not change `pinAppearance` / zoom-based pin sizes in `src/lib/map-pins.ts`.
- Do not re-do list windowing (`PLACE_LIST_PAGE_SIZE`, IntersectionObserver in `src/components/place-list.tsx`) or Settings tabs (Cities / Invite / Account).
- Do not naive-page `BrowsePlace[]` / `PlaceIndex[]` as the primary load-time fix.
- Loading UI must use existing design tokens (`--paper`, `--ink`, `--accent`, `--sheet`, `--muted`). No generic flat gray dashboard skeletons.
- Photos stay `loading="lazy"` on list thumbs. Photo route is not the blank-page problem; do not rebuild it.
- Empty states from polish (“Add a place to start a city.” / “Nothing matches — clear filters.”) are for **true** empty / no-match, never for in-flight loads.
- `toBrowsePlace` may remain for single-place add/update/move; city fetch must not call it per row.
- Keep list windowing. Do not add a task that “lazy-loads list rows” again.
