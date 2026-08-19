> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 6: Google Maps collection CSV parser

**Files:**
- Create: `src/lib/csv.ts`
- Create: `src/lib/csv.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `CsvSeedRow`, `parseMapsCollectionUrl`, `parseCollectionCsv` as specified in overview.md

- [ ] **Step 1: Write the failing tests**

Create `src/lib/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseCollectionCsv, parseMapsCollectionUrl } from "./csv";

const url =
  "https://www.google.com/maps/place/Slant+of+Light+Books/data=!4m2!3m1!1s0x880fd33c9f9f050f:0x8f7f4b4cc0c22510";

describe("parseMapsCollectionUrl", () => {
  it("reads the slug name and feature-id/CID pair", () => {
    expect(parseMapsCollectionUrl(url)).toEqual({
      name: "Slant of Light Books",
      featureCid: "0x880fd33c9f9f050f:0x8f7f4b4cc0c22510",
    });
  });

  it("returns null for a custom pin or unparseable URL", () => {
    expect(
      parseMapsCollectionUrl("https://www.google.com/maps/@30.2,-97.7,14z"),
    ).toBeNull();
    expect(parseMapsCollectionUrl("not-a-url")).toBeNull();
  });
});

describe("parseCollectionCsv", () => {
  it("maps Note and URL, ignores Tags and Comments", () => {
    const csv = [
      "Note,URL,Tags,Comments",
      `"Best used books",${url},,`,
      `"",https://www.google.com/maps/@30.2,-97.7,14z,ignored,ignored`,
    ].join("\n");

    const rows = parseCollectionCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      note: "Best used books",
      url,
      name: "Slant of Light Books",
      featureCid: "0x880fd33c9f9f050f:0x8f7f4b4cc0c22510",
    });
    expect(rows[1]).toEqual({
      note: "",
      url: "https://www.google.com/maps/@30.2,-97.7,14z",
      name: null,
      featureCid: null,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/csv.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/lib/csv.ts`:

```ts
import { parse } from "csv-parse/sync";

export type CsvSeedRow = {
  note: string;
  url: string;
  name: string | null;
  featureCid: string | null;
};

export function parseMapsCollectionUrl(
  url: string,
): { name: string; featureCid: string } | null {
  try {
    const parsed = new URL(url);
    const placeMatch = parsed.pathname.match(/\/place\/([^/]+)/);
    if (!placeMatch) return null;
    const name = decodeURIComponent(placeMatch[1].replaceAll("+", " "));
    const data = parsed.pathname + parsed.search + parsed.hash;
    const cidMatch = data.match(/1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
    if (!cidMatch) return null;
    return { name, featureCid: cidMatch[1] };
  } catch {
    return null;
  }
}

export function parseCollectionCsv(csvText: string): CsvSeedRow[] {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  }) as Record<string, string>[];

  return records.map((row) => {
    const url = row.URL ?? row.url ?? "";
    const parsed = parseMapsCollectionUrl(url);
    return {
      note: row.Note ?? row.note ?? "",
      url,
      name: parsed?.name ?? null,
      featureCid: parsed?.featureCid ?? null,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/csv.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Parse Google Maps collection CSV URLs

* Extract place slug and feature-id/CID from `/place/…/1s0x…:0x…`
* Map Note to notes and ignore Tags and Comments
EOF
git add src/lib/csv.ts src/lib/csv.test.ts
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
