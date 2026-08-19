# Browse load-time — Implementation Plan

**Spec:** [2026-08-16-bop-design.md](../../specs/2026-08-16-bop-design.md) (filter / search semantics), [2026-08-17-bop-ui-polish.md](../../specs/2026-08-17-bop-ui-polish.md) (layout, no clustering)

**Handoff:** load-time diagnosis already closed; this tree only implements those resolutions plus matching UI.

## Required reading order

1. [overview.md](overview.md) — goal, architecture, file map, locked index-vs-card split, target interfaces
2. [global-constraints.md](global-constraints.md) — binding rules for every task
3. [deferred.md](deferred.md) — do not implement (controllers only)
4. Tasks in dependency order (see index). Implementers read only `overview.md`, `global-constraints.md`, and their own task file.

## Task index

| # | Title | Path | Depends on |
|---|---|---|---|
| 1 | Join areas in city fetch | [tasks/01-join-areas.md](tasks/01-join-areas.md) | — |
| 2 | Deduplicate session and slim settings cities | [tasks/02-dedupe-session.md](tasks/02-dedupe-session.md) | 1 |
| 3 | Stream paper browse chrome | [tasks/03-browse-skeleton.md](tasks/03-browse-skeleton.md) | 2 |
| 4 | Defer Maps JS until after the shell | [tasks/04-defer-maps.md](tasks/04-defer-maps.md) | 2 |
| 5 | Slim the city index; fetch card fields on open | [tasks/05-slim-payload.md](tasks/05-slim-payload.md) | 1, 2, 3, 4 |
| 6 | City-switch and place-sheet pending states | [tasks/06-pending-ui.md](tasks/06-pending-ui.md) | 3, 4, 5 |

## Waves

- **Wave A:** Task 1, then Task 2 (both edit `src/actions/browse.ts`).
- **Wave B (parallel after 2):** Tasks 3 and 4.
- **Wave C:** Task 5 (after 3 and 4 so the page move and map tests exist).
- **Wave D:** Task 6 after 5.

## Acceptance mapping

| Requirement | Task |
|---|---|
| Join `areas` once; no per-place `toBrowsePlace` on city load | 1 |
| Skip `user_preferences` when `cityId` is already known | 1 |
| `~N+6` Neon calls → ~4–5 for a city load (session cached + 2–3 data queries) | 1, 2 |
| Pass already-checked session; `cache()` `getAllowedSession` | 2 |
| Settings Cities tab does not wait on a full city places payload | 2 |
| `loading.tsx` + paper skeleton (header, map slot, list); no empty-state flash on first load | 3 |
| Session redirect without depending on place queries | 3 |
| Maps JS after header+list hydrate; reserved paper slot; no clustering | 4 |
| Drop unused/card-only index fields; keep `notes` for search | 5 |
| Optional card fetch; add/update still return full `BrowsePlace` | 5, 6 |
| City switch keeps last-good chrome; list/map pending, not empty | 6 |
| Sheet opens on index fields; notes/attribution/Maps pending only for deferred card fields | 6 |
| List windowing and lazy photos unchanged | (constraint; no task redoes them) |

## Author self-review

- **Spec coverage:** Handoff resolutions 1–5 each have a task. Search-keeps-notes is locked in `overview.md` and tested in task 5. Clustering, Neon HTTP swap, list windowing redo, and naive paging are in `deferred.md` / constraints. UI pending states are task 6, not “polish later.”
- **Placeholder scan:** Task files name exact paths, commands (`npx vitest run …`), expected fail/pass, and commit helper. No TBD / “handle edge cases” / “similar to Task N.”
- **Type consistency:** `PlaceIndex`, `PlaceCardFields`, `BrowsePlace`, `BrowsePayload`, `hasCardFields`, `getBrowsePayloadWithDeps`, `listCitiesWithDeps`, `getPlaceCardWithDeps` / `getPlaceCard` match `overview.md`. Task 1 still maps full `toPlaceRow` until task 5 slims the select. `toBrowsePlace` remains for mutations.

## Post-impl operator asks

None. No new env vars. After Wave D, a human should load `/` on a seeded Chicago city and confirm: paper skeleton before data, list visible before pins, city switch does not empty the list, opening a place shows the sheet immediately.
