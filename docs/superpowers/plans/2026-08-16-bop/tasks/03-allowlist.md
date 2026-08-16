> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 3: Allowlist email check

**Files:**
- Create: `src/lib/allowlist.ts`
- Create: `src/lib/allowlist.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `normalizeEmail`, `parseAllowedEmailsEnv`, `isEmailAllowed` as specified in overview.md

- [ ] **Step 1: Write the failing tests**

Create `src/lib/allowlist.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  isEmailAllowed,
  normalizeEmail,
  parseAllowedEmailsEnv,
} from "./allowlist";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
});

describe("parseAllowedEmailsEnv", () => {
  it("splits on commas and normalizes", () => {
    expect(parseAllowedEmailsEnv(" Ada@x.com, bob@Y.com ")).toEqual([
      "ada@x.com",
      "bob@y.com",
    ]);
  });

  it("returns empty for undefined or blank", () => {
    expect(parseAllowedEmailsEnv(undefined)).toEqual([]);
    expect(parseAllowedEmailsEnv("  ")).toEqual([]);
  });
});

describe("isEmailAllowed", () => {
  it("honors env even when the table is empty", () => {
    expect(
      isEmailAllowed("Ada@x.com", parseAllowedEmailsEnv("ada@x.com"), []),
    ).toBe(true);
  });

  it("honors a table row when env is empty", () => {
    expect(isEmailAllowed("ada@x.com", [], ["ada@x.com"])).toBe(true);
  });

  it("is the union of env and table", () => {
    expect(isEmailAllowed("a@x.com", ["a@x.com"], ["b@x.com"])).toBe(true);
    expect(isEmailAllowed("b@x.com", ["a@x.com"], ["b@x.com"])).toBe(true);
  });

  it("fails closed for unknown mail", () => {
    expect(isEmailAllowed("eve@x.com", ["ada@x.com"], ["bob@x.com"])).toBe(
      false,
    );
  });

  it("normalizes Google, env, and table values before compare", () => {
    expect(
      isEmailAllowed("  ADA@X.com ", ["Ada@x.com"], ["  Bob@X.COM "]),
    ).toBe(true);
    expect(
      isEmailAllowed("bob@x.com", ["ada@x.com"], ["  Bob@X.COM "]),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/allowlist.test.ts`
Expected: FAIL — `allowlist` module not found.

- [ ] **Step 3: Write minimal implementation**

`src/lib/allowlist.ts`:

```ts
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseAllowedEmailsEnv(
  envValue: string | undefined,
): string[] {
  if (!envValue) return [];
  return envValue
    .split(",")
    .map((part) => normalizeEmail(part))
    .filter(Boolean);
}

export function isEmailAllowed(
  email: string,
  envList: string[],
  tableEmails: string[],
): boolean {
  const needle = normalizeEmail(email);
  const haystack = new Set([
    ...envList.map(normalizeEmail),
    ...tableEmails.map(normalizeEmail),
  ]);
  return haystack.has(needle);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/allowlist.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Add allowlist email normalization and union check

* Treat env and table emails as a fail-closed union
* Trim and lowercase Google, env, and table values
EOF
git add src/lib/allowlist.ts src/lib/allowlist.test.ts
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
