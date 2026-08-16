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

function columnIndex(header: string[], ...names: string[]): number {
  for (const name of names) {
    const index = header.indexOf(name);
    if (index >= 0) return index;
  }
  return -1;
}

export function parseCollectionCsv(csvText: string): CsvSeedRow[] {
  const rows = parse(csvText, {
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as string[][];

  if (rows.length === 0) return [];

  const header = rows[0];
  const noteIdx = columnIndex(header, "Note", "note");
  const urlIdx = columnIndex(header, "URL", "url");
  const tailCount = header.length - urlIdx - 1;

  return rows.slice(1).map((fields) => {
    const note = noteIdx >= 0 ? (fields[noteIdx] ?? "") : "";
    let url = "";
    if (urlIdx >= 0) {
      url =
        fields.length > header.length
          ? fields.slice(urlIdx, fields.length - tailCount).join(",")
          : (fields[urlIdx] ?? "");
    }
    const parsed = parseMapsCollectionUrl(url);
    return {
      note,
      url,
      name: parsed?.name ?? null,
      featureCid: parsed?.featureCid ?? null,
    };
  });
}
