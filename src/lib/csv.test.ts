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
