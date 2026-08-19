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
