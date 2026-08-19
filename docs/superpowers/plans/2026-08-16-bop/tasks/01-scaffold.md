> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 1: Scaffold Next.js app and test harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `.env.example`
- Create: `src/lib/sanity.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: npm scripts `dev`, `build`, `test`; path alias `@/*` → `src/*`; Vitest with a `node` project (default) and a `jsdom` project for later UI tests

- [ ] **Step 1: Write the failing sanity test**

Create `src/lib/sanity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("harness", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/sanity.test.ts`
Expected: FAIL because `vitest` is not installed / `vitest.config.ts` is missing.

- [ ] **Step 3: Write scaffold files**

The repo already has `.git`, `.gitignore`, and `docs/`. Do **not** run `create-next-app` (it will refuse a non-empty directory). Write these files.

`package.json`:

```json
{
  "name": "bop",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "seed": "tsx scripts/seed.ts"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

`postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

`vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    projects: [
      {
        resolve: {
          alias: { "@": path.resolve(__dirname, "./src") },
        },
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
        },
      },
      {
        resolve: {
          alias: { "@": path.resolve(__dirname, "./src") },
        },
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
  },
});
```

`src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

`src/app/globals.css`:

```css
@import "tailwindcss";

:root {
  --ink: #1c1917;
  --paper: #f5f0e8;
  --accent: #c45c26;
}

html,
body {
  min-height: 100%;
  background: var(--paper);
  color: var(--ink);
}
```

`src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bop",
  description: "For when you are bopping around town from place to place.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:

```tsx
export default function HomePage() {
  return <main>Bop</main>;
}
```

`.env.example`:

```bash
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ALLOWED_EMAILS=
GOOGLE_PLACES_SERVER_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_KEY=
```

Append to `.gitignore` if missing:

```
drizzle/
next-env.d.ts
```

Keep existing entries: `.superpowers/`, `.env`, `.env*.local`, `node_modules/`, `.next/`.

Install (exact command):

```bash
npm install next@15 react@19 react-dom@19 drizzle-orm @neondatabase/serverless better-auth @vis.gl/react-google-maps zod csv-parse
npm install -D typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss postcss vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event drizzle-kit tsx @electric-sql/pglite
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 1 test (`harness`).

- [ ] **Step 5: Commit**

```bash
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Scaffold the Next.js app and Vitest harness

* Add App Router, Tailwind, path alias, and `package.json` scripts
* Add `.env.example` with Bop env names and a sanity test
EOF
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs vitest.config.ts src/test/setup.ts src/app/layout.tsx src/app/page.tsx src/app/globals.css src/lib/sanity.test.ts .env.example .gitignore
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
