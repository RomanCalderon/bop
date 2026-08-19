> Part of [plan README](README.md). Controllers may use this to reject scope creep. Implementers do not open this file.

## Out of scope

- Map pin clustering, numbered cluster bubbles, Mapbox / MapLibre
- Re-doing visual polish already on `feat/bop-ui-polish` (filter overlay, zoom pins, place sheet, empty states, settings tabs)
- Re-doing client list windowing
- Photo pipeline / Places API caching beyond first paint
- Switching off Neon HTTP (`neon-http` → websocket / pool) as a first move
- Load tests, visual regression, live Google tests in CI
- Auth/invite product changes
- City deletion, seed CLI changes
- Per-user lists, new filter dimensions, visited/hours/price
- Naive server paging of the city place index
- Deferring `notes` off the city index (that is a product change to search)
- Changing `pinAppearance` zoom breakpoints
