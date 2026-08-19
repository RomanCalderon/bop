> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 9: Better Auth, Google OAuth, allowlist gate

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/lib/auth-client.ts`
- Create: `src/lib/session.ts`
- Create: `src/lib/session.test.ts`
- Create: `src/lib/require-allowed.ts`
- Create: `src/app/api/auth/[...all]/route.ts`
- Create: `src/middleware.ts`
- Create: `src/app/sign-in/page.tsx`
- Create: `src/app/not-invited/page.tsx`

**Interfaces:**
- Consumes: `normalizeEmail`, `parseAllowedEmailsEnv`, `isEmailAllowed` from `src/lib/allowlist.ts`; `allowedEmails` table; Better Auth `user` table
- Produces: `auth`; `authClient`; `getAllowedSession()` as specified in overview.md; `requireAllowedSession()` that returns `AllowedUser` or throws `{ status: 401 | 403 }`

- [ ] **Step 1: Write the failing session tests**

`getAllowedSession` reads the real Better Auth API and the database. For unit tests, extract the decision into `evaluateSession` so the gate is testable without Google.

Create `src/lib/session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { evaluateSession } from "./session";

describe("evaluateSession", () => {
  it("is unauthenticated when there is no session user", () => {
    expect(
      evaluateSession({
        email: null,
        envValue: "ada@x.com",
        tableEmails: [],
      }),
    ).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("is not_invited when the Google email is outside env ∪ table", () => {
    expect(
      evaluateSession({
        email: "eve@x.com",
        envValue: "ada@x.com",
        tableEmails: ["bob@x.com"],
      }),
    ).toEqual({ ok: false, reason: "not_invited" });
  });

  it("allows an env email and a table email after normalize", () => {
    expect(
      evaluateSession({
        email: "  ADA@X.com ",
        envValue: "Ada@x.com",
        tableEmails: [],
      }).ok,
    ).toBe(true);
    expect(
      evaluateSession({
        email: "bob@x.com",
        envValue: "",
        tableEmails: ["  Bob@X.COM "],
      }).ok,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/session.test.ts`
Expected: FAIL — `evaluateSession` is not exported.

- [ ] **Step 3: Write auth, session gate, pages, and middleware**

`src/lib/auth.ts`:

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  plugins: [nextCookies()],
});
```

`src/lib/auth-client.ts`:

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
```

`src/lib/session.ts`:

```ts
import { headers } from "next/headers";
import { db } from "@/db";
import { allowedEmails } from "@/db/schema";
import {
  isEmailAllowed,
  parseAllowedEmailsEnv,
} from "./allowlist";
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

export async function getAllowedSession(): Promise<
  | { ok: true; user: AllowedUser }
  | { ok: false; reason: "unauthenticated" | "not_invited" }
> {
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
}
```

`src/lib/require-allowed.ts`:

```ts
import { getAllowedSession } from "./session";

export async function requireAllowedSession() {
  const session = await getAllowedSession();
  if (!session.ok) {
    const error = new Error(session.reason) as Error & { status: number };
    error.status = session.reason === "unauthenticated" ? 401 : 403;
    throw error;
  }
  return session.user;
}
```

`src/app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
```

`src/middleware.ts`:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/sign-in", "/not-invited", "/api/auth"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  const cookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");
  if (!cookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

Middleware only checks that a session cookie exists. Allowlist is enforced in `getAllowedSession` on every server page, action, and the photo route. An unallowlisted signed-in user who hits `/` is redirected to `/not-invited` by the page (Task 12/13). For this task, `src/app/page.tsx` should already redirect:

```tsx
import { redirect } from "next/navigation";
import { getAllowedSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getAllowedSession();
  if (!session.ok && session.reason === "unauthenticated") {
    redirect("/sign-in");
  }
  if (!session.ok && session.reason === "not_invited") {
    redirect("/not-invited");
  }
  return <main>Bop</main>;
}
```

`src/app/sign-in/page.tsx` (server shell + client button):

```tsx
import { SignInButton } from "@/components/sign-in-button";

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold">Bop</h1>
      <p className="text-stone-600">
        For when you are bopping around town from place to place.
      </p>
      <SignInButton />
    </main>
  );
}
```

`src/components/sign-in-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInButton() {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="rounded-full bg-[var(--ink)] px-4 py-2 text-[var(--paper)]"
        onClick={() => {
          setError(null);
          void authClient.signIn.social({ provider: "google" }).catch(() => {
            setError("Couldn’t sign in. Try again.");
          });
        }}
      >
        Continue with Google
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
```

`src/app/not-invited/page.tsx`:

```tsx
export default function NotInvitedPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 px-6">
      <h1 className="text-2xl font-semibold">Not invited</h1>
      <p className="text-stone-600">
        This Bop is invite-only. Ask someone already on the list to add your
        Google email.
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/session.test.ts src/lib/allowlist.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Gate the app behind Google OAuth and an email allowlist

* Add Better Auth Google sign-in and session evaluation
* Redirect unknown emails to a not-invited screen with no place data
EOF
git add src/lib/auth.ts src/lib/auth-client.ts src/lib/session.ts src/lib/session.test.ts src/lib/require-allowed.ts src/app/api/auth/\[...all\]/route.ts src/middleware.ts src/app/page.tsx src/app/sign-in/page.tsx src/app/not-invited/page.tsx src/components/sign-in-button.tsx
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
