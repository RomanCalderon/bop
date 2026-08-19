import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";
import type { BrowsePayload, BrowsePlace, PlaceIndex } from "@/lib/places-types";

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
};

function toIndexPlace(p: BrowsePlace): PlaceIndex {
  return {
    id: p.id,
    placeId: p.placeId,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    formattedAddress: p.formattedAddress,
    cityId: p.cityId,
    areaId: p.areaId,
    areaName: p.areaName,
    type: p.type,
    extraTags: p.extraTags,
    notes: p.notes,
    photoName: p.photoName,
  };
}

const payload: BrowsePayload = {
  city: { id: "c1", name: "Austin", centerLat: 30.27, centerLng: -97.74 },
  cities: [{ id: "c1", name: "Austin", placeCount: 1 }],
  types: ["book store"],
  areas: [{ id: "east", name: "East" }],
  extraTags: [],
  places: [toIndexPlace(place)],
};

describe("AppShell", () => {
  it("opens detail from a list row and from a pin", async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        initial={payload}
        onCityChange={async () => payload}
        getPlaceCard={async () => place}
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

  it("adds a place from the overlay and opens its details card", async () => {
    const user = userEvent.setup();
    const added: BrowsePlace = { ...place, id: "p2", name: "New Cafe", type: "cafe" };
    render(
      <AppShell
        initial={payload}
        onCityChange={async () => payload}
        getPlaceCard={async () => place}
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
    expect(
      await screen.findByRole("heading", { name: "New Cafe" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "New Cafe" })).toBeInTheDocument();
  });

  it("sets city and cities after the first add from empty", async () => {
    const user = userEvent.setup();
    const empty: BrowsePayload = {
      city: null,
      cities: [],
      places: [],
      types: [],
      areas: [],
      extraTags: [],
    };
    const afterAdd: BrowsePayload = {
      ...payload,
      places: [place],
    };
    const onCityChange = vi.fn(async () => afterAdd);
    render(
      <AppShell
        initial={empty}
        onCityChange={onCityChange}
        getPlaceCard={async () => place}
        searchPlaces={async () => ({
          ok: true,
          suggestions: [
            {
              placeId: "ChIJ1",
              primaryText: "Slant of Light Books",
              secondaryText: "Austin, TX",
            },
          ],
        })}
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
    expect(screen.getByRole("button", { name: /city/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Add place" }));
    await user.type(screen.getByPlaceholderText("Search Google places"), "books");
    await user.click(screen.getByRole("button", { name: /Slant of Light Books/ }));
    expect(onCityChange).toHaveBeenCalledWith("c1");
    expect(
      await screen.findByRole("heading", { name: "Slant of Light Books" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /city/i })).toBeNull();
    expect(screen.getByLabelText("City")).toHaveValue("c1");
  });

  it("opens the existing place when a move is blocked", async () => {
    const user = userEvent.setup();
    const chicagoPlace: BrowsePlace = {
      ...place,
      id: "p-chi",
      cityId: "c2",
      name: "Slant of Light Books Chicago",
      formattedAddress: "Chicago",
    };
    const cities = [
      { id: "c1", name: "Austin", placeCount: 1 },
      { id: "c2", name: "Chicago", placeCount: 1 },
    ];
    const austinPayload: BrowsePayload = { ...payload, cities };
    const chicagoPayload: BrowsePayload = {
      city: { id: "c2", name: "Chicago", centerLat: 41.8, centerLng: -87.6 },
      cities,
      types: ["book store"],
      areas: [],
      extraTags: [],
      places: [toIndexPlace(chicagoPlace)],
    };
    render(
      <AppShell
        initial={austinPayload}
        onCityChange={async (id) => (id === "c2" ? chicagoPayload : austinPayload)}
        getPlaceCard={async (id) => (id === "p-chi" ? chicagoPlace : place)}
        searchPlaces={async () => ({ ok: true, suggestions: [] })}
        addPlace={async () => ({ ok: true, place, created: true })}
        updatePlace={async () => ({ ok: true, place })}
        deletePlace={async () => ({ ok: true })}
        movePlace={async () => ({
          ok: false,
          message: "Already saved in that city.",
          existingPlaceId: "p-chi",
        })}
        createArea={async () => ({
          ok: true,
          area: { id: "east", name: "East" },
        })}
      />,
    );
    await user.click(screen.getByText("Slant of Light Books"));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Edit" }));
    await user.selectOptions(
      within(screen.getByRole("dialog")).getByLabelText("City"),
      "c2",
    );
    expect(
      await screen.findByRole("heading", { name: "Slant of Light Books Chicago" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Already saved in that city.",
    );
  });

  it("opens the sheet from a list row before card fields return", async () => {
    const user = userEvent.setup();
    const indexOnly = {
      id: place.id,
      placeId: place.placeId,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      formattedAddress: place.formattedAddress,
      cityId: place.cityId,
      areaId: place.areaId,
      areaName: place.areaName,
      type: place.type,
      extraTags: place.extraTags,
      notes: place.notes,
      photoName: place.photoName,
    };
    const initial = { ...payload, places: [indexOnly] };
    let resolveCard: (value: BrowsePlace) => void = () => {};
    const cardPromise = new Promise<BrowsePlace>((resolve) => {
      resolveCard = resolve;
    });
    const getPlaceCard = vi.fn(() => cardPromise);
    render(
      <AppShell
        initial={initial}
        onCityChange={async () => initial}
        getPlaceCard={getPlaceCard}
        searchPlaces={async () => ({ ok: true, suggestions: [] })}
        addPlace={async () => ({ ok: true, place, created: true })}
        updatePlace={async () => ({ ok: true, place })}
        deletePlace={async () => ({ ok: true })}
        movePlace={async () => ({ ok: true, place })}
        createArea={async () => ({ ok: true, area: { id: "east", name: "East" } })}
      />,
    );
    await user.click(screen.getByText("Slant of Light Books"));
    expect(screen.getByRole("heading", { name: "Slant of Light Books" })).toBeInTheDocument();
    expect(getPlaceCard).toHaveBeenCalledWith("p1");
    expect(screen.getByRole("button", { name: "Open in Google Maps" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    resolveCard(place);
    expect(await screen.findByText("Photo: Ada")).toBeInTheDocument();
  });

  it("ignores a late card fetch after another place is opened", async () => {
    const user = userEvent.setup();
    const placeB: BrowsePlace = {
      ...place,
      id: "p2",
      placeId: "ChIJ2",
      name: "New Cafe",
      type: "cafe",
      rating: 4.2,
      googleMapsUrl: "https://maps.google.com/?cid=2",
      authorAttributions: [{ displayName: "Bea", uri: null }],
    };
    const initial = {
      ...payload,
      types: ["book store", "cafe"],
      places: [toIndexPlace(place), toIndexPlace(placeB)],
    };
    let resolveA: (value: BrowsePlace) => void = () => {};
    const cardA = new Promise<BrowsePlace>((resolve) => {
      resolveA = resolve;
    });
    const cardB = new Promise<BrowsePlace>(() => {});
    const getPlaceCard = vi.fn((id: string) => (id === "p1" ? cardA : cardB));
    render(
      <AppShell
        initial={initial}
        onCityChange={async () => initial}
        getPlaceCard={getPlaceCard}
        searchPlaces={async () => ({ ok: true, suggestions: [] })}
        addPlace={async () => ({ ok: true, place, created: true })}
        updatePlace={async () => ({ ok: true, place })}
        deletePlace={async () => ({ ok: true })}
        movePlace={async () => ({ ok: true, place })}
        createArea={async () => ({ ok: true, area: { id: "east", name: "East" } })}
      />,
    );
    await user.click(screen.getByText("Slant of Light Books"));
    expect(screen.getByRole("heading", { name: "Slant of Light Books" })).toBeInTheDocument();
    await user.click(screen.getByText("New Cafe"));
    expect(screen.getByRole("heading", { name: "New Cafe" })).toBeInTheDocument();
    await act(async () => {
      resolveA(place);
    });
    expect(screen.getByRole("heading", { name: "New Cafe" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Slant of Light Books" })).not.toBeInTheDocument();
    expect(screen.queryByText("Photo: Ada")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in Google Maps" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("does not refetch card fields after add already returned a full place", async () => {
    const user = userEvent.setup();
    const getPlaceCard = vi.fn(async () => place);
    const added: BrowsePlace = { ...place, id: "p2", name: "New Cafe", type: "cafe" };
    render(
      <AppShell
        initial={payload}
        onCityChange={async () => payload}
        getPlaceCard={getPlaceCard}
        searchPlaces={async () => ({
          ok: true,
          suggestions: [
            { placeId: "ChIJ-new", primaryText: "New Cafe", secondaryText: "Austin, TX" },
          ],
        })}
        addPlace={async () => ({ ok: true, place: added, created: true })}
        updatePlace={async () => ({ ok: true, place })}
        deletePlace={async () => ({ ok: true })}
        movePlace={async () => ({ ok: true, place })}
        createArea={async () => ({ ok: true, area: { id: "east", name: "East" } })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Add place" }));
    await user.type(screen.getByPlaceholderText("Search Google places"), "cafe");
    await user.click(screen.getByRole("button", { name: /New Cafe/ }));
    expect(
      await screen.findByRole("heading", { name: "New Cafe" }),
    ).toBeInTheDocument();
    expect(getPlaceCard).not.toHaveBeenCalled();
  });
});
