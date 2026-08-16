import { describe, expect, it } from "vitest";
import {
  filterPlaces,
  haversineKm,
  sortByDistance,
  type PlaceFilterable,
} from "./filters";

const places: PlaceFilterable[] = [
  {
    name: "Slant of Light Books",
    formattedAddress: "123 E 7th St, Austin, TX",
    notes: "Quiet used books",
    type: "book store",
    extraTags: ["rainy-day"],
    areaId: "east",
    lat: 30.267,
    lng: -97.743,
  },
  {
    name: "Nickel City",
    formattedAddress: "Austin, TX",
    notes: "Dive bar",
    type: "bar",
    extraTags: ["late"],
    areaId: "east",
    lat: 30.26,
    lng: -97.72,
  },
  {
    name: "Houndstooth",
    formattedAddress: "South Congress, Austin",
    notes: "",
    type: "cafe",
    extraTags: ["coffee"],
    areaId: "south",
    lat: 30.25,
    lng: -97.75,
  },
];

const none = {
  query: "",
  type: null,
  areaId: null,
  extraTag: null,
};

describe("filterPlaces", () => {
  it("matches free text against name, address, notes, type, and extra tags", () => {
    expect(filterPlaces(places, { ...none, query: "quiet" }).map((p) => p.name)).toEqual([
      "Slant of Light Books",
    ]);
    expect(filterPlaces(places, { ...none, query: "congress" }).map((p) => p.name)).toEqual([
      "Houndstooth",
    ]);
    expect(filterPlaces(places, { ...none, query: "book store" }).map((p) => p.name)).toEqual([
      "Slant of Light Books",
    ]);
    expect(filterPlaces(places, { ...none, query: "late" }).map((p) => p.name)).toEqual([
      "Nickel City",
    ]);
  });

  it("filters type, area, and extra tag exactly", () => {
    expect(filterPlaces(places, { ...none, type: "bar" }).map((p) => p.name)).toEqual([
      "Nickel City",
    ]);
    expect(filterPlaces(places, { ...none, areaId: "south" }).map((p) => p.name)).toEqual([
      "Houndstooth",
    ]);
    expect(
      filterPlaces(places, { ...none, extraTag: "rainy-day" }).map((p) => p.name),
    ).toEqual(["Slant of Light Books"]);
  });

  it("ANDs combined filters", () => {
    expect(
      filterPlaces(places, {
        query: "austin",
        type: "bar",
        areaId: "east",
        extraTag: "late",
      }).map((p) => p.name),
    ).toEqual(["Nickel City"]);
    expect(
      filterPlaces(places, {
        query: "austin",
        type: "bar",
        areaId: "south",
        extraTag: null,
      }),
    ).toEqual([]);
  });
});

describe("sortByDistance", () => {
  it("orders nearer places first", () => {
    const origin = { lat: 30.267, lng: -97.743 };
    const sorted = sortByDistance(places, origin);
    expect(sorted[0]?.name).toBe("Slant of Light Books");
    expect(haversineKm(origin, sorted[0]!)).toBeLessThan(
      haversineKm(origin, sorted[1]!),
    );
  });
});
