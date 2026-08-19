> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 3: Stream paper browse chrome

**Files:**
- Create: `src/components/browse-skeleton.tsx`
- Create: `src/components/browse-skeleton.test.tsx`
- Create: `src/app/(browse)/layout.tsx`
- Create: `src/app/(browse)/loading.tsx`
- Rename: `src/app/page.tsx` → `src/app/(browse)/page.tsx`
- Test: `src/components/browse-skeleton.test.tsx`

**Interfaces:**
- Consumes: Task 2 `HomePage` body (`getAllowedSession` + `getBrowsePayloadWithDeps`); tokens in `src/app/globals.css`; grid classes from `src/components/browse-app.tsx`
- Produces: `BrowseSkeleton`, `MapSlotPlaceholder`, `PlaceListSkeleton`. `(browse)/layout.tsx` session-gates and redirects. `(browse)/loading.tsx` renders `BrowseSkeleton`. Unauthenticated users never depend on place queries. Skeleton does not show polish empty-state copy.

Next.js: `loading.tsx` wraps **page.tsx of the same segment**, not the layout. Session in `(browse)/layout.tsx` so the skeleton covers payload wait, not the sign-in redirect. Do not put `"use client"` on the skeleton. Do not defer Maps here (task 4). Do not change city-switch behavior (task 6).

- [ ] **Step 1: Write the failing test**

`src/components/browse-skeleton.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrowseSkeleton } from "./browse-skeleton";

describe("BrowseSkeleton", () => {
  it("paints paper chrome without empty-state copy", () => {
    const { container } = render(<BrowseSkeleton />);
    const status = screen.getByRole("status", { name: "Loading places" });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Add a place to start a city.")).not.toBeInTheDocument();
    expect(screen.queryByText("No saved place matches this search.")).not.toBeInTheDocument();
    expect(container.innerHTML).toContain("var(--paper)");
    expect(container.innerHTML).toContain("var(--ink)");
    expect(container.innerHTML).not.toMatch(/bg-(gray|zinc|slate|stone)-/);
    expect(status.className).toMatch(/40vh/);
    expect(status.className).toMatch(/28rem/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/browse-skeleton.test.tsx`

Expected: FAIL — `Cannot find module './browse-skeleton'` (or similar).

- [ ] **Step 3: Write minimal implementation**

`src/components/browse-skeleton.tsx`:

```tsx
const pulse =
  "animate-pulse motion-reduce:animate-none bg-[color-mix(in_srgb,var(--ink)_8%,var(--paper))]";

export function MapSlotPlaceholder({ busy = true }: { busy?: boolean }) {
  return (
    <div
      data-testid="map-slot"
      aria-hidden={busy ? undefined : true}
      className="h-full min-h-0 bg-[var(--paper)]"
    />
  );
}

export function PlaceListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="min-h-0 flex-1" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <div className={`h-14 w-14 shrink-0 rounded-lg ${pulse}`} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className={`h-4 w-2/3 rounded ${pulse}`} />
            <div className={`h-3 w-1/2 rounded ${pulse}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function BrowseSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading places"
      className="grid min-h-dvh grid-rows-[auto_40vh_auto_minmax(0,1fr)] bg-[var(--paper)] text-[var(--ink)] md:h-dvh md:grid-cols-[28rem_minmax(0,1fr)] md:grid-rows-[auto_auto_minmax(0,1fr)]"
    >
      <header className="flex items-center justify-between gap-2 px-4 py-3 md:col-start-1 md:row-start-1 md:border-r md:border-[color-mix(in_srgb,var(--ink)_12%,var(--paper))]">
        <div className={`h-6 w-28 rounded ${pulse}`} />
        <div className="flex items-center gap-2">
          <div className={`h-9 w-9 rounded-full ${pulse}`} />
          <div className={`h-9 w-9 rounded-full ${pulse}`} />
          <div className={`h-9 w-9 rounded-full ${pulse}`} />
        </div>
      </header>
      <div className="h-full min-h-0 md:col-start-2 md:row-span-3 md:row-start-1">
        <MapSlotPlaceholder />
      </div>
      <div className="px-4 py-3 md:col-start-1 md:row-start-2 md:border-r md:border-[color-mix(in_srgb,var(--ink)_12%,var(--paper))]">
        <div className={`h-10 w-full rounded-full ${pulse}`} />
      </div>
      <section
        aria-label="Places"
        className="flex min-h-0 flex-col md:col-start-1 md:row-start-3 md:border-r md:border-[color-mix(in_srgb,var(--ink)_12%,var(--paper))]"
      >
        <PlaceListSkeleton />
      </section>
    </div>
  );
}
```

`src/app/(browse)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getAllowedSession } from "@/lib/session";

export default async function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAllowedSession();
  if (!session.ok && session.reason === "unauthenticated") redirect("/sign-in");
  if (!session.ok && session.reason === "not_invited") redirect("/not-invited");
  return children;
}
```

`src/app/(browse)/loading.tsx`:

```tsx
import { BrowseSkeleton } from "@/components/browse-skeleton";

export default function BrowseLoading() {
  return <BrowseSkeleton />;
}
```

Move the existing home page (do not rewrite AppShell props):

```bash
mkdir -p src/app/\(browse\)
git mv src/app/page.tsx src/app/\(browse\)/page.tsx
```

The moved file already calls `getBrowsePayloadWithDeps(db, session.user.id, null)` from task 2. Layout already redirected unauthenticated users; the extra `getAllowedSession` in the page is `cache()`d and is how the page reads `user.id`. Leave that call in place.

Do not move `src/app/settings/page.tsx`, `sign-in`, or `not-invited` into `(browse)` — those must not show `BrowseSkeleton`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/browse-skeleton.test.tsx src/components/browse-app.test.tsx src/components/app-shell.test.tsx`

Expected: PASS. Then `npm run typecheck`.

Expected: PASS (no missing `src/app/page.tsx` imports).

- [ ] **Step 5: Commit**

```bash
git add src/components/browse-skeleton.tsx src/components/browse-skeleton.test.tsx src/app/\(browse\)/layout.tsx src/app/\(browse\)/page.tsx src/app/\(browse\)/loading.tsx
git add -u src/app/page.tsx
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Stream paper browse chrome before place data

* Add `BrowseSkeleton` and `(browse)/loading.tsx` using existing tokens
* Gate session in `(browse)/layout.tsx` so the skeleton covers payload wait
EOF
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
