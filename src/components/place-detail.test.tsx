import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlaceDetail } from "./place-detail";
import type { PlaceIndex, BrowsePlace } from "@/lib/places-types";

const indexPlace: PlaceIndex = {
  id: "p1",
  placeId: "ChIJ1",
  name: "Slant of Light Books",
  lat: 30.27,
  lng: -97.74,
  formattedAddress: "Austin",
  cityId: "c1",
  areaId: "east",
  areaName: "East",
  type: "book store",
  extraTags: ["quiet"],
  notes: "Go on a weekday",
  photoName: "places/ChIJ1/photos/AAA",
};

const fullPlace: BrowsePlace = {
  ...indexPlace,
  rating: 4.8,
  googleMapsUrl: "https://maps.google.com/?cid=1",
  authorAttributions: [{ displayName: "Ada", uri: null }],
};

const noop = {
  cities: [{ id: "c1", name: "Austin" }],
  areas: [{ id: "east", name: "East" }],
  updatePlace: async () => ({ ok: true as const, place: fullPlace }),
  deletePlace: async () => ({ ok: true as const }),
  movePlace: async () => ({ ok: true as const, place: fullPlace }),
  createArea: async () => ({ ok: true as const, area: { id: "east", name: "East" } }),
  onClose: () => {},
  onChanged: () => {},
  onDeleted: () => {},
  onError: () => {},
};

describe("PlaceDetail", () => {
  it("opens immediately on index fields and marks card extras pending", () => {
    render(
      <PlaceDetail
        {...noop}
        place={indexPlace}
        cardStatus="pending"
      />,
    );
    expect(screen.getByRole("heading", { name: "Slant of Light Books" })).toBeInTheDocument();
    expect(screen.getByText("Go on a weekday")).toBeInTheDocument();
    expect(screen.getByText("quiet")).toBeInTheDocument();
    expect(screen.queryByText("Photo: Ada")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in Google Maps" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByRole("link", { name: "Open in Google Maps" })).not.toBeInTheDocument();
  });

  it("does not mark Maps busy when ready without a maps url", () => {
    render(
      <PlaceDetail
        {...noop}
        place={indexPlace}
        cardStatus="ready"
      />,
    );
    expect(screen.getByRole("heading", { name: "Slant of Light Books" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open in Google Maps" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open in Google Maps" })).not.toBeInTheDocument();
  });

  it("shows attribution and maps link when card fields are ready", () => {
    render(
      <PlaceDetail
        {...noop}
        place={fullPlace}
        cardStatus="ready"
      />,
    );
    expect(screen.getByText("Photo: Ada")).toBeInTheDocument();
    expect(screen.getByText(/4\.8/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Google Maps" })).toHaveAttribute(
      "href",
      "https://maps.google.com/?cid=1",
    );
    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      "/api/photos?name=places%2FChIJ1%2Fphotos%2FAAA&h=800",
    );
  });
});
