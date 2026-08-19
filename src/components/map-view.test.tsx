import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MapView } from "./map-view";
import type { BrowsePlace } from "@/lib/places-types";

vi.mock("./map-canvas", () => ({
  MapCanvas: () => <div data-testid="map-canvas" />,
}));

const place: BrowsePlace = {
  id: "p1",
  placeId: "ChIJ1",
  name: "Slant of Light Books",
  lat: 30.27,
  lng: -97.74,
  formattedAddress: "Austin",
  cityId: "c1",
  areaId: null,
  areaName: null,
  type: "book store",
  extraTags: [],
  notes: "",
  rating: 4.8,
  googleMapsUrl: "https://maps.google.com/?cid=1",
  photoName: null,
  authorAttributions: [],
};

describe("MapView", () => {
  it("shows the reserved paper slot before Maps JS loads", () => {
    render(
      <MapView
        city={{ id: "c1", name: "Austin", centerLat: 30.27, centerLng: -97.74 }}
        places={[place]}
        markerIds={["p1"]}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByTestId("map-slot")).toBeInTheDocument();
    expect(screen.queryByTestId("map-canvas")).not.toBeInTheDocument();
  });

  it("loads the map canvas after mount", async () => {
    render(
      <MapView
        city={{ id: "c1", name: "Austin", centerLat: 30.27, centerLng: -97.74 }}
        places={[place]}
        markerIds={["p1"]}
        onSelect={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("map-canvas")).toBeInTheDocument();
    });
  });
});
