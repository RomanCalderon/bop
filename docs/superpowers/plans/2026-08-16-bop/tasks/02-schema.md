> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 2: Drizzle schema and PGlite test database

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/init.sql`
- Create: `src/db/index.ts`
- Create: `src/test/pglite.ts`
- Create: `src/db/schema.test.ts`
- Create: `drizzle.config.ts`

**Interfaces:**
- Consumes: nothing from later tasks
- Produces: Drizzle tables `user`, `session`, `account`, `verification`, `allowedEmails`, `cities`, `areas`, `places`, `userPreferences`; `createTestDb()`; `export type BopDb` from `src/db/index.ts`

- [ ] **Step 1: Write the failing constraint test**

Create `src/db/schema.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { allowedEmails, areas, cities, places } from "./schema";
import { createTestDb } from "@/test/pglite";

describe("schema constraints", () => {
  it("rejects a second place with the same place_id in the same city", async () => {
    const { db, client } = await createTestDb();
    const [city] = await db
      .insert(cities)
      .values({ id: "city-1", name: "Austin" })
      .returning();

    await db.insert(places).values({
      id: "p1",
      placeId: "ChIJ1",
      name: "One",
      lat: 30.2,
      lng: -97.7,
      formattedAddress: "Austin, TX",
      cityId: city.id,
    });

    await expect(
      db.insert(places).values({
        id: "p2",
        placeId: "ChIJ1",
        name: "Two",
        lat: 30.2,
        lng: -97.7,
        formattedAddress: "Austin, TX",
        cityId: city.id,
      }),
    ).rejects.toThrow();

    await client.close();
  });

  it("allows the same place_id in two cities", async () => {
    const { db, client } = await createTestDb();
    await db.insert(cities).values([
      { id: "c1", name: "Austin" },
      { id: "c2", name: "Chicago" },
    ]);
    await db.insert(places).values([
      {
        id: "p1",
        placeId: "ChIJ1",
        name: "One",
        lat: 30.2,
        lng: -97.7,
        formattedAddress: "Austin",
        cityId: "c1",
      },
      {
        id: "p2",
        placeId: "ChIJ1",
        name: "One",
        lat: 41.8,
        lng: -87.6,
        formattedAddress: "Chicago",
        cityId: "c2",
      },
    ]);
    const rows = await db.select().from(places).where(eq(places.placeId, "ChIJ1"));
    expect(rows).toHaveLength(2);
    await client.close();
  });

  it("rejects a duplicate non-null seed_feature_cid", async () => {
    const { db, client } = await createTestDb();
    await db.insert(cities).values({ id: "c1", name: "Austin" });
    await db.insert(places).values({
      id: "p1",
      placeId: "ChIJ1",
      name: "One",
      lat: 30.2,
      lng: -97.7,
      formattedAddress: "Austin",
      cityId: "c1",
      seedFeatureCid: "0xaaa:0xbbb",
    });
    await expect(
      db.insert(places).values({
        id: "p2",
        placeId: "ChIJ2",
        name: "Two",
        lat: 30.2,
        lng: -97.7,
        formattedAddress: "Austin",
        cityId: "c1",
        seedFeatureCid: "0xaaa:0xbbb",
      }),
    ).rejects.toThrow();
    await client.close();
  });

  it("rejects a second area with the same name in a city ignoring case", async () => {
    const { db, client } = await createTestDb();
    await db.insert(cities).values({ id: "c1", name: "Austin" });
    await db.insert(areas).values({
      id: "a1",
      cityId: "c1",
      name: "East Austin",
    });
    await expect(
      db.insert(areas).values({
        id: "a2",
        cityId: "c1",
        name: "east austin",
      }),
    ).rejects.toThrow();
    await client.close();
  });

  it("stores allowed emails uniquely", async () => {
    const { db, client } = await createTestDb();
    await db.insert(allowedEmails).values({
      id: "e1",
      email: "ada@example.com",
    });
    await expect(
      db.insert(allowedEmails).values({
        id: "e2",
        email: "ada@example.com",
      }),
    ).rejects.toThrow();
    await client.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/schema.test.ts`
Expected: FAIL with `createTestDb is not a function` or cannot find module.

- [ ] **Step 3: Write schema, SQL, and test db helper**

`src/db/schema.ts`:

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { PhotoAttribution } from "@/lib/places-types";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const allowedEmails = pgTable(
  "allowed_emails",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("allowed_emails_email_uidx").on(t.email)],
);

export const cities = pgTable(
  "cities",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    centerLat: doublePrecision("center_lat"),
    centerLng: doublePrecision("center_lng"),
  },
  (t) => [uniqueIndex("cities_name_uidx").on(sql`lower(${t.name})`)],
);

export const areas = pgTable(
  "areas",
  {
    id: text("id").primaryKey(),
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [
    uniqueIndex("areas_city_name_uidx").on(t.cityId, sql`lower(${t.name})`),
  ],
);

export const places = pgTable(
  "places",
  {
    id: text("id").primaryKey(),
    placeId: text("place_id").notNull(),
    name: text("name").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    formattedAddress: text("formatted_address").notNull(),
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id),
    areaId: text("area_id").references(() => areas.id),
    type: text("type"),
    extraTags: text("extra_tags").array().notNull().default([]),
    notes: text("notes").notNull().default(""),
    rating: doublePrecision("rating"),
    googleMapsUrl: text("google_maps_url").notNull().default(""),
    photoName: text("photo_name"),
    authorAttributions: jsonb("author_attributions")
      .$type<PhotoAttribution[]>()
      .notNull()
      .default([]),
    seedFeatureCid: text("seed_feature_cid"),
  },
  (t) => [
    uniqueIndex("places_place_id_city_id_uidx").on(t.placeId, t.cityId),
    uniqueIndex("places_seed_feature_cid_uidx")
      .on(t.seedFeatureCid)
      .where(sql`${t.seedFeatureCid} is not null`),
  ],
);

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  lastCityId: text("last_city_id").references(() => cities.id),
});
```

`schema.ts` imports `PhotoAttribution`. Create a temporary type file so this compiles before Task 4 owns the full module — write `src/lib/places-types.ts` with **only**:

```ts
export type PhotoAttribution = {
  displayName: string;
  uri: string | null;
};
```

Task 4 will add the rest of the types to this same file. Do not rename the type.

`src/db/init.sql` — tables and indexes matching the Drizzle schema (text PKs, partial unique on `seed_feature_cid`, `lower(name)` uniques). Include Better Auth tables so later auth tests can insert users:

```sql
create table if not exists "user" (
  id text primary key,
  name text not null,
  email text not null unique,
  email_verified boolean not null default false,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists "session" (
  id text primary key,
  expires_at timestamptz not null,
  token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  user_id text not null references "user"(id) on delete cascade
);

create table if not exists "account" (
  id text primary key,
  account_id text not null,
  provider_id text not null,
  user_id text not null references "user"(id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists "verification" (
  id text primary key,
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists allowed_emails (
  id text primary key,
  email text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists allowed_emails_email_uidx on allowed_emails (email);

create table if not exists cities (
  id text primary key,
  name text not null,
  center_lat double precision,
  center_lng double precision
);
create unique index if not exists cities_name_uidx on cities (lower(name));

create table if not exists areas (
  id text primary key,
  city_id text not null references cities(id) on delete cascade,
  name text not null
);
create unique index if not exists areas_city_name_uidx on areas (city_id, lower(name));

create table if not exists places (
  id text primary key,
  place_id text not null,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  formatted_address text not null,
  city_id text not null references cities(id),
  area_id text references areas(id),
  type text,
  extra_tags text[] not null default '{}',
  notes text not null default '',
  rating double precision,
  google_maps_url text not null default '',
  photo_name text,
  author_attributions jsonb not null default '[]',
  seed_feature_cid text
);
create unique index if not exists places_place_id_city_id_uidx on places (place_id, city_id);
create unique index if not exists places_seed_feature_cid_uidx on places (seed_feature_cid) where seed_feature_cid is not null;

create table if not exists user_preferences (
  user_id text primary key references "user"(id) on delete cascade,
  last_city_id text references cities(id)
);
```

`src/test/pglite.ts`:

```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";

export async function createTestDb() {
  const client = new PGlite();
  const sql = readFileSync(path.join(process.cwd(), "src/db/init.sql"), "utf8");
  await client.exec(sql);
  const db = drizzle(client, { schema });
  return { db, client };
}
```

`src/db/index.ts`:

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function createDb(url: string) {
  return drizzle(neon(url), { schema });
}

export const db = createDb(process.env.DATABASE_URL ?? "postgres://unused");

export type BopDb = ReturnType<typeof createDb> | Awaited<
  ReturnType<typeof import("@/test/pglite").createTestDb>
>["db"];
```

Do not import `@/test/pglite` from `index.ts` at runtime in a way that bundles PGlite into Next. Keep `BopDb` as:

```ts
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type * as schema from "./schema";

export type BopDb =
  | NeonHttpDatabase<typeof schema>
  | PgliteDatabase<typeof schema>;
```

`drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/schema.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Commit**

```bash
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Add Drizzle schema and PGlite test database

* Define cities, areas, places, allowlist, preferences, and Better Auth tables
* Enforce `(place_id, city_id)`, partial seed CID, and per-city area uniqueness
EOF
git add src/db/schema.ts src/db/init.sql src/db/index.ts src/db/schema.test.ts src/test/pglite.ts src/lib/places-types.ts drizzle.config.ts
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
