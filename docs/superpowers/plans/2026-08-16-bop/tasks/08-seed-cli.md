> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 8: Seed CLI and review report

**Files:**
- Create: `src/lib/seed.ts`
- Create: `src/lib/seed.test.ts`
- Create: `scripts/seed.ts`
- Create: `scripts/fixtures/seed-sample.csv`

**Interfaces:**
- Consumes: `parseCollectionCsv` from `src/lib/csv.ts`; `insertPlace` from `src/lib/place-insert.ts`; `PlacesPort`, `TextSearchHit`, `PlaceDetails` from `src/lib/places-types.ts`; `createTestDb`
- Produces: `SeedReport`, `seedCollection` as specified in overview.md; CLI writes `seed-report.md` next to the CSV (or `./seed-report.md` if no directory)

- [ ] **Step 1: Write the failing seed tests**

Create `scripts/fixtures/seed-sample.csv`:

```csv
Note,URL,Tags,Comments
"Quiet used books",https://www.google.com/maps/place/Slant+of+Light+Books/data=!4m2!3m1!1s0xaaa:0x111,,
"",https://www.google.com/maps/place/Common+Name/data=!4m2!3m1!1s0xbbb:0x222,,
"",https://www.google.com/maps/place/Ghost+Pin/data=!4m2!3m1!1s0xccc:0x333,,
"",https://www.google.com/maps/place/No+City+Cafe/data=!4m2!3m1!1s0xddd:0x444,,
```

Create `src/lib/seed.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { places } from "@/db/schema";
import { createTestDb } from "@/test/pglite";
import { insertPlace } from "./place-insert";
import type { PlaceDetails, PlacesPort, TextSearchHit } from "./places-types";
import { seedCollection } from "./seed";

const fixture = readFileSync(
  path.join(process.cwd(), "scripts/fixtures/seed-sample.csv"),
  "utf8",
);

function details(overrides: Partial<PlaceDetails> = {}): PlaceDetails {
  return {
    placeId: "ChIJ-books",
    name: "Slant of Light Books",
    lat: 30.26,
    lng: -97.74,
    formattedAddress: "Austin, TX",
    addressComponents: [
      { types: ["locality"], longText: "Austin" },
      { types: ["neighborhood"], longText: "Downtown" },
    ],
    primaryType: "book_store",
    rating: 4.8,
    googleMapsUri: "https://maps.google.com/?cid=1",
    photoName: "places/ChIJ-books/photos/ABC",
    authorAttributions: [],
    ...overrides,
  };
}

function fakePlaces(impl: {
  textSearch: PlacesPort["textSearch"];
  getDetails: PlacesPort["getDetails"];
}): PlacesPort {
  return {
    autocomplete: async () => [],
    textSearch: impl.textSearch,
    getDetails: impl.getDetails,
    fetchPhoto: async () => null,
  };
}

describe("seedCollection", () => {
  it("buckets resolved, ambiguous, failed, and persists Note only on resolve", async () => {
    const { db, client } = await createTestDb();
    const textSearch = vi.fn(async (query: string): Promise<TextSearchHit[]> => {
      if (query === "Slant of Light Books") {
        return [
          {
            placeId: "ChIJ-books",
            name: "Slant of Light Books",
            formattedAddress: "Austin, TX",
          },
        ];
      }
      if (query === "Common Name") {
        return [
          { placeId: "ChIJ-a", name: "Common A", formattedAddress: "A" },
          { placeId: "ChIJ-b", name: "Common B", formattedAddress: "B" },
        ];
      }
      if (query === "Ghost Pin") return [];
      if (query === "No City Cafe") {
        return [
          {
            placeId: "ChIJ-nocity",
            name: "No City Cafe",
            formattedAddress: "Somewhere",
          },
        ];
      }
      return [];
    });
    const getDetails = vi.fn(async (placeId: string) => {
      if (placeId === "ChIJ-books") return details();
      if (placeId === "ChIJ-nocity") {
        return details({
          placeId,
          name: "No City Cafe",
          addressComponents: [{ types: ["country"], longText: "US" }],
        });
      }
      return null;
    });

    const report = await seedCollection({
      db,
      places: fakePlaces({ textSearch, getDetails }),
      csvText: fixture,
    });

    expect(report.resolved).toHaveLength(1);
    expect(report.resolved[0]?.note).toBe("Quiet used books");
    expect(report.resolved[0]?.reused).toBe(false);
    expect(report.ambiguous).toHaveLength(1);
    expect(report.ambiguous[0]?.candidates).toEqual([
      { placeId: "ChIJ-a", name: "Common A", formattedAddress: "A" },
      { placeId: "ChIJ-b", name: "Common B", formattedAddress: "B" },
    ]);
    expect(report.failed.map((f) => f.reason).sort()).toEqual(
      ["city_inference_failed", "zero_results"].sort(),
    );
    const rows = await db.select().from(places);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.notes).toBe("Quiet used books");
    expect(rows[0]?.seedFeatureCid).toBe("0xaaa:0x111");
    await client.close();
  });

  it("skips Text Search when feature-id/CID is already stored", async () => {
    const { db, client } = await createTestDb();
    await insertPlace(db, {
      details: details(),
      notes: "already",
      seedFeatureCid: "0xaaa:0x111",
      cityPolicy: { type: "seed" },
    });
    const textSearch = vi.fn(async () => []);
    const report = await seedCollection({
      db,
      places: fakePlaces({
        textSearch,
        getDetails: async () => null,
      }),
      csvText: fixture,
    });
    expect(textSearch).not.toHaveBeenCalledWith("Slant of Light Books");
    expect(
      report.resolved.find((r) => r.featureCid === "0xaaa:0x111")?.reused,
    ).toBe(true);
    expect(await db.select().from(places)).toHaveLength(1);
    await client.close();
  });

  it("reuses an existing (place_id, city_id) without a second insert", async () => {
    const { db, client } = await createTestDb();
    await insertPlace(db, {
      details: details(),
      notes: "in-app add",
      cityPolicy: { type: "seed" },
    });
    const textSearch = vi.fn(async (query: string): Promise<TextSearchHit[]> => {
      if (query === "Slant of Light Books") {
        return [
          {
            placeId: "ChIJ-books",
            name: "Slant of Light Books",
            formattedAddress: "Austin, TX",
          },
        ];
      }
      return [];
    });
    const report = await seedCollection({
      db,
      places: fakePlaces({
        textSearch,
        getDetails: async () => details(),
      }),
      csvText: `Note,URL,Tags,Comments\n"",https://www.google.com/maps/place/Slant+of+Light+Books/data=!4m2!3m1!1s0xeee:0x555,,\n`,
    });
    expect(report.resolved[0]?.reused).toBe(true);
    expect(await db.select().from(places)).toHaveLength(1);
    await client.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/seed.test.ts`
Expected: FAIL — `seedCollection` is not a function.

- [ ] **Step 3: Write seed runner and CLI**

`src/lib/seed.ts`:

```ts
import { eq } from "drizzle-orm";
import type { BopDb } from "@/db";
import { places } from "@/db/schema";
import { parseCollectionCsv } from "./csv";
import { insertPlace } from "./place-insert";
import type { PlacesPort, TextSearchHit } from "./places-types";

export type SeedReportEntry = {
  name: string | null;
  url: string;
  featureCid: string | null;
  note: string;
};

export type SeedReport = {
  resolved: (SeedReportEntry & {
    placeId: string;
    cityId: string;
    reused: boolean;
  })[];
  ambiguous: (SeedReportEntry & { candidates: TextSearchHit[] })[];
  failed: (SeedReportEntry & { reason: string })[];
};

export async function seedCollection(opts: {
  db: BopDb;
  places: PlacesPort;
  csvText: string;
}): Promise<SeedReport> {
  const report: SeedReport = { resolved: [], ambiguous: [], failed: [] };
  const rows = parseCollectionCsv(opts.csvText);

  for (const row of rows) {
    const base: SeedReportEntry = {
      name: row.name,
      url: row.url,
      featureCid: row.featureCid,
      note: row.note,
    };

    if (row.featureCid) {
      const existing = await opts.db
        .select()
        .from(places)
        .where(eq(places.seedFeatureCid, row.featureCid))
        .limit(1);
      if (existing[0]) {
        report.resolved.push({
          ...base,
          placeId: existing[0].placeId,
          cityId: existing[0].cityId,
          reused: true,
        });
        continue;
      }
    }

    if (!row.name) {
      report.failed.push({ ...base, reason: "unparseable_url" });
      continue;
    }

    let hits: TextSearchHit[];
    try {
      hits = await opts.places.textSearch(row.name);
    } catch {
      report.failed.push({ ...base, reason: "api_error" });
      continue;
    }

    if (hits.length === 0) {
      report.failed.push({ ...base, reason: "zero_results" });
      continue;
    }
    if (hits.length > 1) {
      report.ambiguous.push({ ...base, candidates: hits });
      continue;
    }

    const details = await opts.places.getDetails(hits[0].placeId);
    if (!details) {
      report.failed.push({ ...base, reason: "details_failed" });
      continue;
    }

    const inserted = await insertPlace(opts.db, {
      details,
      notes: row.note,
      seedFeatureCid: row.featureCid,
      cityPolicy: { type: "seed" },
    });

    if (!inserted.ok) {
      report.failed.push({ ...base, reason: inserted.reason });
      continue;
    }

    report.resolved.push({
      ...base,
      placeId: inserted.place.placeId,
      cityId: inserted.place.cityId,
      reused: !inserted.created,
    });
  }

  return report;
}

export function formatSeedReport(report: SeedReport): string {
  const lines = ["# Bop seed report", ""];
  lines.push(`## Resolved (${report.resolved.length})`);
  for (const row of report.resolved) {
    lines.push(
      `- ${row.name} — ${row.placeId} — city ${row.cityId}${row.reused ? " (reused)" : ""}`,
    );
  }
  lines.push("", `## Ambiguous (${report.ambiguous.length})`);
  for (const row of report.ambiguous) {
    lines.push(`- ${row.name} (${row.url})`);
    for (const c of row.candidates) {
      lines.push(`  - ${c.name} — ${c.formattedAddress} — ${c.placeId}`);
    }
  }
  lines.push("", `## Failed (${report.failed.length})`);
  for (const row of report.failed) {
    lines.push(`- ${row.name ?? row.url} — ${row.reason}`);
  }
  return lines.join("\n") + "\n";
}
```

`scripts/seed.ts`:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createDb } from "../src/db";
import { createPlacesClient } from "../src/lib/places";
import { formatSeedReport, seedCollection } from "../src/lib/seed";

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: npx tsx scripts/seed.ts <collection.csv>");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  const key = process.env.GOOGLE_PLACES_SERVER_KEY;
  if (!url || !key) {
    console.error("DATABASE_URL and GOOGLE_PLACES_SERVER_KEY are required");
    process.exit(1);
  }
  const csvText = readFileSync(csvPath, "utf8");
  const report = await seedCollection({
    db: createDb(url),
    places: createPlacesClient(key),
    csvText,
  });
  const out = path.join(path.dirname(path.resolve(csvPath)), "seed-report.md");
  writeFileSync(out, formatSeedReport(report));
  console.log(`Wrote ${out}`);
  console.log(
    `resolved=${report.resolved.length} ambiguous=${report.ambiguous.length} failed=${report.failed.length}`,
  );
}

main();
```

`createPlacesClient` does not exist until Task 10. To keep Task 8 independently testable, add this stub at the bottom of `src/lib/places.ts` so the CLI typechecks. Task 10 replaces the body.

```ts
import type { PlacesPort } from "./places-types";

export function createPlacesClient(_apiKey: string): PlacesPort {
  throw new Error("Places client is implemented in a later task");
}
```

Unit tests import `seedCollection` only and never call the CLI or `createPlacesClient`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/seed.test.ts`
Expected: PASS. The two skip paths fail independently if either is broken: the CID test asserts `textSearch` was not called with that name; the `(place_id, city_id)` test asserts a single row and `reused: true`.

- [ ] **Step 5: Commit**

```bash
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Add the report-only seed runner

* Classify rows as resolved, ambiguous, or failed without an interactive picker
* Skip Text Search on stored feature-id/CID and reuse `(place_id, city_id)`
EOF
git add src/lib/seed.ts src/lib/seed.test.ts src/lib/places.ts scripts/seed.ts scripts/fixtures/seed-sample.csv
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
