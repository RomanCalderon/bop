# Bop — UI polish design spec (Claude Design handoff)

**Date:** 2026-08-17  
**Status:** Ready for visual design  
**Parent spec:** [2026-08-16-bop-design.md](2026-08-16-bop-design.md)  
**Current implementation:** `src/components/browse-app.tsx`, `filter-bar.tsx`, `place-list.tsx`, `map-view.tsx`, `place-detail.tsx`

This is a **visual / interaction polish** of the existing phone-first browse experience. It does not change the data model, auth, seed, or filter semantics. It exists so a Claude Design agent can produce a polished mobile UI without rediscovering the product.

---

## Product (do not redesign)

Bop is an invite-only, phone-first web app for a small circle to browse one shared, city-scoped list of saved places on a custom Google Map.

Tagline: *For when you are bopping around town from place to place.*

**Job to be done:** Open the app, see the city, search or skim the list, tap a place, go there (or edit a note). Filters and the map are in service of that — they are not the product.

**Audience:** A handful of invited friends on a phone, often one-handed, often outdoors. Not a consumer maps startup. Not an admin console.

**What already works and must stay**

- One shared list. City switcher in the header. Near-me, add (`+`), Settings.
- Phone: split stack — header, map on top (~40vh), search/filters, list always visible below.
- Desktop: list + filters left (~28rem), map right. Place detail is a **side panel**, not a sheet.
- Filters AND together: free-text + one type + one area + one extra tag. Search matches name, address, notes, type, extra tags.
- List row: cover photo, name, type · area · extra tags · distance (when near-me is on).
- Place detail: cover, name, type, area, rating, extra tags, shared notes, Open in Google Maps, edit (notes / tags / type / area / city), delete, photo attribution.
- Empty: “Add a place to start a city.” / “Nothing matches — clear filters.”
- Custom warm paper map (POI and transit icons off). Bop pins are the only POIs.

**Out of scope for this design pass**

- Sign-in, not-invited, Settings, Add-place overlay (keep the same visual language if you touch them; do not invent new flows).
- Clustering as a product feature, Mapbox, per-user lists, visited/hours/price, new filter dimensions.
- Changing AND-filter semantics or making type/area/tag multi-select.

---

## Evaluation of the three requested changes

The current UI is a faithful first implementation of the v1 spec: chips always visible, default Google markers, a paper-colored bottom sheet with a “Close” text button and no scrim. That was correct for a two-place fixture. It fails on a seeded city (Chicago) with many types, neighborhoods, and pins.

### 1. Hide type / area / tag catalogs; search is primary

**Verdict: accept, with three corrections.**

The original spec put “search + filter chips between” map and list. That assumed a small personal collection. After a Google Maps collection seed, `types` + `areas` + `extraTags` dump into one wrapping row and steal the list. Search already covers name, address, notes, type, and extra tags, so the catalog does not need to be the default chrome.

**Corrections the visual design must include**

1. **Collapsed row is one line.** Put a Filters control **to the right of** the search field, not below it. A second row of chrome recreates the original problem.
2. **Active filters stay visible when the catalog is hidden.** If the user picked “bar” and “Wicker Park”, collapsing the panel must not erase that context. Show compact selected chips (or a count badge on Filters) plus a Clear control. Hidden-active-filters is worse than crowded chips.
3. **Expand into an overlay, not an inline wrap.** Opening the catalog as another wrapping chip row just pushes the list down again. Use a bottom sheet or popover over the list. Group chips into **Type / Area / Tags** — the current UI dumps all three into one wrap, which is part of why it feels noisy.
4. **Clear is two things.** An X inside the search field clears text only. A “Clear filters” action resets query + type + area + extra tag. The empty-state line “Nothing matches — clear filters.” should be a tappable reset, not copy.
5. **Area is not in the search haystack today.** Hiding area chips without a Filters panel would make neighborhoods unreachable unless the name appears in the address. The Filters panel is required, not optional.

Do not replace chips with a multi-select tag cloud or a faceted desktop sidebar on phone.

### 2. Pins that respond to zoom

**Verdict: accept size-by-zoom; do not lead with clustering.**

`MapView` uses the default Google `Marker` (fixed teardrop, Google red). At city zoom (~12) a Chicago collection crowds into unreadable stacks. The custom map already hides Google POIs; default red pins also fight the paper/ink/accent system.

**What to design**

| Map zoom (Google) | Pin treatment |
|---|---|
| ≤ 11 (metro / whole city) | 6–8px filled **dots**, no stem, no label |
| 12–14 (neighborhood) | 10–12px discs |
| ≥ 15 (street) | 20–24px branded pin (accent disc or short stem) |

- Color: accent `#c45c26` on the paper map, not Google red. Unselected pins are the same family; selected pin is larger **and** ringed at every zoom so it stays findable after the sheet opens.
- No place-name labels on pins (the map already has street labels).
- Overlap at city zoom is acceptable if the marks are small dots. Do **not** design numbered cluster bubbles for this pass — they hide the collection and change the tap model. If two places share a building, the selected ring is enough.

The design agent should show the **same city** at two zooms (Chicago pulled back vs a neighborhood) so the size change is obvious.

### 3. Place sheet as a layer, not a continuation of the list

**Verdict: accept handle + scrim + tap-outside; keep an accessible close; fix content hierarchy.**

The current sheet is `fixed` to the bottom, same `--paper` as the page, `shadow-xl`, no dim overlay, and a literal “Close” button. Add-place already uses `bg-black/40`. The sheet reads as a layout shift, not a layer.

**Chrome (phone)**

- Dim scrim over map + list (`~40%` black, matching Add-place). Tap scrim dismisses.
- Handle bar, top-center, 36×4px, muted ink. Suggests swipe-down. Tapping the handle also dismisses.
- Optional icon-only X (`aria-label="Close"`) on the trailing edge. Do **not** use the word “Close”. Do **not** rely on swipe alone — handle + scrim + X.
- Sheet surface sits above the scrim: larger top radius (24px), stronger shadow, surface slightly distinct from page paper (a hair lighter or a 1px hairline). Max height ~80vh. Map remains peeking above so the pin stays in context.
- Swipe-to-dismiss is the intended motion; the visual must read as a sheet even if the first implementation only does tap-to-dismiss.

**Chrome (desktop)**

- Keep a **right side panel** (original spec). No handle bar. X + optional scrim. Do not port the phone sheet to `md+`.

**Content hierarchy (required, not extra scope)**

The current sheet is an edit form: notes, tags, type, area, city, Save, Delete all land immediately. A polished maps sheet is a **place card** first.

1. Handle / close
2. Cover photo
3. Name, then type · area · rating
4. Extra tags as quiet chips
5. Shared notes (readable; tap to edit or an Edit control)
6. Primary action: Open in Google Maps
7. Secondary: Edit (reveals type / area / city / tags / save / delete)

Do not invent new fields. Do not hide attribution — keep “Photo: {name}” under the cover.

---

## Visual system (already in the product)

Use these tokens. Do not introduce a second palette.

| Token | Value | Use |
|---|---|---|
| `--ink` | `#1c1917` | Text, selected controls, primary buttons |
| `--paper` | `#f5f0e8` | Page background, list, sheet base |
| `--accent` | `#c45c26` | Pins, active filter, primary emphasis |
| Map land | `#efe6d6` | Custom map geometry |
| Map water | `#d7c4a3` | Lake / river |
| Map roads | `#e4d8c4` / `#dcc9a8` | Streets / highways |
| Map labels | `#5c5346` | Street names |

- Type: system UI / a warm grotesque. No display serif, no Inter-on-white SaaS look.
- Radius: search and primary buttons `full`; photos `lg`; sheet top `2xl` (24px).
- Density: phone-first. List rows stay tappable (~56px+). Do not shrink the list to make room for chrome.
- Motion: 200–250ms ease-out for sheet enter; honor `prefers-reduced-motion`.

**Reference products for interaction, not skin:** Apple Maps place card, Google Maps bottom sheet, Linear’s mobile search+filter. Skin stays paper / ink / rust.

---

## Screens to produce

Design **phone first** at 390×844. Use Chicago as the sample city. Fake 8–12 places (bookstores, bars, restaurants) across Wicker Park, Logan Square, West Loop.

| # | Frame | What it must prove |
|---|---|---|
| 1 | Browse, default | Header + map + **one-line** search/Filters + list. No type/area/tag catalog. Pins at neighborhood zoom (discs). |
| 2 | Filters open | Overlay/sheet grouped Type / Area / Tags. List still readable underneath. |
| 3 | Filters applied, panel closed | Search + Filters + compact active chips + Clear. List and map reduced. |
| 4 | Search typed | Query in the field, X to clear text, matching rows only. |
| 5 | Map zoomed out | Same city at metro zoom: small accent **dots**, no teardrop crowd. |
| 6 | Map zoomed in | Street zoom: larger branded pins. One selected + ring. |
| 7 | Place sheet open | Scrim, handle, no “Close” text, card hierarchy (photo → meta → Maps → Edit). Map peeks above. |
| 8 | Desktop (optional, 1280×800) | List left, map right, detail as side panel with X, no handle. |

Also show the two empty states if they fit a ninth frame; do not spend the pass on Settings or Add.

---

## Copy and a11y

- Search placeholder: `Search places`
- Filters button: icon + accessible name `Filters`. Badge = count of active chip filters (not including query).
- Clear: `Clear` or `Clear filters` when anything is active.
- Sheet close: icon, `aria-label="Close"`.
- Handle: `aria-label="Dismiss"` (or decorative if X is present).
- Icon-only header actions (`+`, near-me, settings) need labels. Near-me may stay a short word or become an icon; do not add more header text.
- Focus rings on every control. Contrast on accent-on-paper and ink-on-paper.

---

## Suggested skills for the implementing agent (after design)

- `ui-ux-pro-max` — semantic sheet, focus, reduced motion
- `plugin-svelte-svelte` is **not** relevant (this app is Next.js + React)
- Existing tests: `browse-app.test.tsx` clicks a type chip by name (`bar`); `app-shell.test.tsx` clicks `getByRole("button", { name: "Close" })`. Implementation must keep those behaviors addressable (chip still exists in the Filters panel; close still has an accessible name).
