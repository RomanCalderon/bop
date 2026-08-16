import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";
import type { BrowsePayload, BrowsePlace } from "@/lib/places-types";

vi.mock("./map-view", () => ({
  MapView: ({
    onSelect,
  }: {
    onSelect: (id: string) => void;
  }) => (
    <button type="button" onClick={() => onSelect("p1")}>
      pin-p1
    </button>
  ),
}));

const place: BrowsePlace = {
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
  extraTags: [],
  notes: "Quiet",
  rating: 4.8,
  googleMapsUrl: "https://maps.google.com/?cid=1",
  photoName: "places/ChIJ1/photos/AAA",
  authorAttributions: [{ displayName: "Ada", uri: null }],
  seedFeatureCid: null,
};

const payload: BrowsePayload = {
  city: { id: "c1", name: "Austin", centerLat: 30.27, centerLng: -97.74 },
  cities: [{ id: "c1", name: "Austin", placeCount: 1 }],
  types: ["book store"],
  areas: [{ id: "east", name: "East" }],
  extraTags: [],
  places: [place],
};

describe("AppShell", () => {
  it("opens detail from a list row and from a pin", async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        initial={payload}
        onCityChange={async () => payload}
        searchPlaces={async () => ({ ok: true, suggestions: [] })}
        addPlace={async () => ({ ok: true, place, created: true })}
        updatePlace={async () => ({ ok: true, place })}
        deletePlace={async () => ({ ok: true })}
        movePlace={async () => ({ ok: true, place })}
        createArea={async () => ({
          ok: true,
          area: { id: "east", name: "East" },
        })}
      />,
    );
    await user.click(screen.getByText("Slant of Light Books"));
    expect(screen.getByRole("heading", { name: "Slant of Light Books" })).toBeInTheDocument();
    expect(screen.getByText("Photo: Ada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByText("pin-p1"));
    expect(screen.getByRole("heading", { name: "Slant of Light Books" })).toBeInTheDocument();
  });

  it("adds a place from the overlay and shows the new row", async () => {
    const user = userEvent.setup();
    const added: BrowsePlace = { ...place, id: "p2", name: "New Cafe", type: "cafe" };
    render(
      <AppShell
        initial={payload}
        onCityChange={async () => payload}
        searchPlaces={async () => ({
          ok: true,
          suggestions: [
            {
              placeId: "ChIJ-new",
              primaryText: "New Cafe",
              secondaryText: "Austin, TX",
            },
          ],
        })}
        addPlace={async () => ({ ok: true, place: added, created: true })}
        updatePlace={async () => ({ ok: true, place })}
        deletePlace={async () => ({ ok: true })}
        movePlace={async () => ({ ok: true, place })}
        createArea={async () => ({
          ok: true,
          area: { id: "east", name: "East" },
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Add place" }));
    await user.type(screen.getByPlaceholderText("Search Google places"), "cafe");
    await user.click(screen.getByRole("button", { name: /New Cafe/ }));
    expect(screen.getByText("New Cafe")).toBeInTheDocument();
  });
});
