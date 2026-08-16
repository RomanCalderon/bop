import "server-only";

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
