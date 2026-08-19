> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 2: Deduplicate session and slim settings cities

**Files:**
- Modify: `src/lib/session.ts`
- Modify: `src/lib/session.test.ts`
- Modify: `src/actions/browse.ts`
- Modify: `src/actions/browse.test.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/settings/page.tsx`
- Test: `src/lib/session.test.ts`, `src/actions/browse.test.ts`

**Interfaces:**
- Consumes: Task 1 `getBrowsePayloadWithDeps`; existing `getAllowedSession` body; `BopDb` / `cities`
- Produces: `getAllowedSession` is `cache()`d. `listCitiesWithDeps(database)` returns `{ id, name }[]` and does not query `places`. `/` and `/settings` pass the already-checked user into data loaders instead of going through `getBrowsePayload()` → `requireAllowedSession()`.

Do not add `loading.tsx` here (task 3). Do not slim place columns (task 5).

- [ ] **Step 1: Write the failing tests**

`src/lib/session.test.ts` — keep the `evaluateSession` tests. After the existing mocks, import `getAllowedSession` and `auth`, and add:

```ts
import { getAllowedSession } from "./session";
import { auth } from "./auth";

describe("getAllowedSession", () => {
  it("reuses the Better Auth lookup when called twice", async () => {
    const getSession = vi
      .spyOn(auth.api, "getSession")
      .mockResolvedValue({
        user: { id: "u1", email: "ada@x.com", name: "Ada" },
      } as never);
    await getAllowedSession();
    await getAllowedSession();
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});
```

The current mock is `getSession: async () => null`. The spy replaces it. Before `cache()`, this fails with `calledTimes: 2`.

`src/actions/browse.test.ts` — add (reuse `spySql` from task 1; if that helper is not in the file yet, copy it from task 1):

```ts
import { listCitiesWithDeps } from "./browse";

describe("listCitiesWithDeps", () => {
  it("returns city names without querying places", async () => {
    const { db, client } = await createTestDb();
    await insertPlace(db, { details: downtown, notes: "", cityPolicy: { type: "seed" } });
    const sql = spySql(client);
    const listed = await listCitiesWithDeps(db);
    expect(listed).toEqual([{ id: expect.any(String), name: "Austin" }]);
    expect(sql.some((s) => /from\s+"?places"?/i.test(s))).toBe(false);
    await client.close();
  });
});
```

Use the same `downtown` / `austin` fixture already in the file (`name` locality Austin).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/session.test.ts src/actions/browse.test.ts`

Expected: FAIL — `getSession` called twice; `listCitiesWithDeps` is not exported.

- [ ] **Step 3: Write minimal implementation**

`src/lib/session.ts` — wrap the existing function:

```ts
import { cache } from "react";
import { headers } from "next/headers";
import { db } from "@/db";
import { allowedEmails } from "@/db/schema";
import { isEmailAllowed, parseAllowedEmailsEnv } from "./allowlist";
import { auth } from "./auth";

export type AllowedUser = { id: string; email: string; name: string };

export function evaluateSession(input: {
  email: string | null;
  envValue: string | undefined;
  tableEmails: string[];
}): { ok: true } | { ok: false; reason: "unauthenticated" | "not_invited" } {
  if (!input.email) return { ok: false, reason: "unauthenticated" };
  const envList = parseAllowedEmailsEnv(input.envValue);
  if (!isEmailAllowed(input.email, envList, input.tableEmails)) {
    return { ok: false, reason: "not_invited" };
  }
  return { ok: true };
}

export const getAllowedSession = cache(async (): Promise<
  | { ok: true; user: AllowedUser }
  | { ok: false; reason: "unauthenticated" | "not_invited" }
> => {
  const session = await auth.api.getSession({ headers: await headers() });
  const email = session?.user.email ?? null;
  const tableRows = await db.select().from(allowedEmails);
  const decision = evaluateSession({
    email,
    envValue: process.env.ALLOWED_EMAILS,
    tableEmails: tableRows.map((r) => r.email),
  });
  if (!decision.ok) return decision;
  return {
    ok: true,
    user: {
      id: session!.user.id,
      email: session!.user.email,
      name: session!.user.name,
    },
  };
});
```

`src/actions/browse.ts` — add `listCitiesWithDeps`. Keep `getBrowsePayload` for any leftover callers, but pages must not use it:

```ts
export async function listCitiesWithDeps(database: BopDb) {
  const rows = await database
    .select({ id: cities.id, name: cities.name })
    .from(cities)
    .orderBy(asc(cities.name));
  return rows;
}
```

`src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { addPlace, deletePlace, movePlace, searchPlaces, updatePlace } from "@/actions/places";
import { changeCity, getBrowsePayloadWithDeps } from "@/actions/browse";
import { createArea } from "@/actions/settings";
import { AppShell } from "@/components/app-shell";
import { db } from "@/db";
import { getAllowedSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getAllowedSession();
  if (!session.ok && session.reason === "unauthenticated") redirect("/sign-in");
  if (!session.ok && session.reason === "not_invited") redirect("/not-invited");
  if (!session.ok) redirect("/sign-in");
  const initial = await getBrowsePayloadWithDeps(db, session.user.id, null);
  return (
    <AppShell
      initial={initial}
      onCityChange={changeCity}
      searchPlaces={searchPlaces}
      addPlace={addPlace}
      updatePlace={updatePlace}
      deletePlace={deletePlace}
      movePlace={movePlace}
      createArea={createArea}
    />
  );
}
```

`src/app/settings/page.tsx` — drop `getBrowsePayload`. Import `db` and `listCitiesWithDeps`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { listCitiesWithDeps } from "@/actions/browse";
import {
  inviteEmail,
  listAllowedEmails,
  removeAllowedEmail,
  renameCity,
} from "@/actions/settings";
import { SettingsForm } from "@/components/settings-form";
import { db } from "@/db";
import { getAllowedSession } from "@/lib/session";

export default async function SettingsPage() {
  const session = await getAllowedSession();
  if (!session.ok) {
    redirect(session.reason === "unauthenticated" ? "/sign-in" : "/not-invited");
  }
  const emails = await listAllowedEmails();
  const cities = await listCitiesWithDeps(db);
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href="/" className="text-sm underline">
        Back
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Settings</h1>
      <SettingsForm
        envEmails={emails.env}
        tableEmails={emails.table}
        cities={cities}
        userEmail={session.user.email}
        inviteEmail={inviteEmail}
        removeAllowedEmail={removeAllowedEmail}
        renameCity={renameCity}
      />
    </main>
  );
}
```

`listAllowedEmails` still calls `requireAllowedSession`; that is fine because `getAllowedSession` is now cached for the request.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/session.test.ts src/actions/browse.test.ts src/components/settings-form.test.tsx`

Expected: PASS.

If the cache test still sees two `getSession` calls, confirm `getAllowedSession` is the `cache()` wrapper and that the test imports it after `vi.mock`. Do not replace `cache()` with a module-level `let` memo — that would leak across requests in production.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.ts src/lib/session.test.ts src/actions/browse.ts src/actions/browse.test.ts src/app/page.tsx src/app/settings/page.tsx
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Reuse the allowlisted session and load settings cities without places

* Wrap `getAllowedSession` in React `cache()` so `/` does not auth twice
* Add `listCitiesWithDeps` and stop calling `getBrowsePayload` from settings
EOF
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
