import { describe, expect, it } from "vitest";
import {
  displayType,
  inferAreaName,
  inferCityName,
} from "./infer-location";
import type { AddressComponent } from "./places-types";

function component(types: string[], longText: string): AddressComponent {
  return { types, longText };
}

describe("inferCityName", () => {
  it("prefers locality over administrative_area_level_1", () => {
    expect(
      inferCityName([
        component(["administrative_area_level_1"], "Texas"),
        component(["locality"], "Austin"),
      ]),
    ).toBe("Austin");
  });

  it("falls back to administrative_area_level_1", () => {
    expect(
      inferCityName([component(["administrative_area_level_1"], "Texas")]),
    ).toBe("Texas");
  });

  it("returns null when neither is present", () => {
    expect(
      inferCityName([component(["country"], "United States")]),
    ).toBeNull();
  });
});

describe("inferAreaName", () => {
  it("uses neighborhood, then sublocality, then sublocality_level_1", () => {
    expect(
      inferAreaName([
        component(["sublocality"], "South"),
        component(["neighborhood"], "Travis Heights"),
      ]),
    ).toBe("Travis Heights");
    expect(inferAreaName([component(["sublocality"], "South")])).toBe("South");
    expect(
      inferAreaName([component(["sublocality_level_1"], "Hyde Park")]),
    ).toBe("Hyde Park");
  });

  it("returns null when no area component exists", () => {
    expect(inferAreaName([component(["locality"], "Austin")])).toBeNull();
  });
});

describe("displayType", () => {
  it("replaces underscores with spaces", () => {
    expect(displayType("book_store")).toBe("book store");
  });

  it("returns null for null", () => {
    expect(displayType(null)).toBeNull();
  });
});
