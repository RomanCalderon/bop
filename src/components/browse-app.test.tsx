import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BrowseApp } from "./browse-app";
import type { BrowsePayload } from "@/lib/places-types";

vi.mock("./map-view", () => ({
  MapView: ({
    markerIds,
  }: {
    markerIds: string[];
  }) => <div data-testid="markers">{markerIds.join(",")}</div>,
}));

const payload: BrowsePayload = {
  city: { id: "c1", name: "Austin", centerLat: 30.27, centerLng: -97.74 },
  cities: [
    { id: "c1", name: "Austin", placeCount: 2 },
    { id: "c2", name: "Chicago", placeCount: 1 },
  ],
  types: ["bar", "book store"],
  areas: [{ id: "east", name: "East" }],
  extraTags: ["late"],
  places: [
    {
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
      photoName: null,
    },
    {
      id: "p2",
      placeId: "ChIJ2",
      name: "Nickel City",
      lat: 30.26,
      lng: -97.72,
      formattedAddress: "Austin",
      cityId: "c1",
      areaId: "east",
      areaName: "East",
      type: "bar",
      extraTags: ["late"],
      notes: "",
      photoName: null,
    },
  ],
};

describe("BrowseApp", () => {
  it("filters the list and marker ids together", async () => {
    const user = userEvent.setup();
    render(
      <BrowseApp
        payload={payload}
        onCityChange={async () => payload}
      />,
    );
    expect(screen.getByText("Slant of Light Books")).toBeInTheDocument();
    expect(screen.getByTestId("markers").textContent).toContain("p1");
    expect(screen.queryByRole("button", { name: "bar" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("button", { name: "bar" }));
    expect(screen.queryByText("Slant of Light Books")).not.toBeInTheDocument();
    expect(screen.getByText("Nickel City")).toBeInTheDocument();
    expect(screen.getByTestId("markers").textContent).toBe("p2");
  });

  it("shows the no-match empty state", async () => {
    const user = userEvent.setup();
    render(
      <BrowseApp
        payload={payload}
        onCityChange={async () => payload}
      />,
    );
    await user.type(screen.getByPlaceholderText("Search places"), "zzzz");
    expect(
      screen.getByText("Nothing matches — clear filters."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nothing matches — clear filters." }));
    expect(screen.getByText("Slant of Light Books")).toBeInTheDocument();
    expect(screen.getByText("Nickel City")).toBeInTheDocument();
  });

  it("shows the no-city empty state", () => {
    render(
      <BrowseApp
        payload={{
          city: null,
          cities: [],
          places: [],
          types: [],
          areas: [],
          extraTags: [],
        }}
        onCityChange={async () => payload}
      />,
    );
    expect(
      screen.getByText("Add a place to start a city."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /city/i })).toBeDisabled();
  });

  it("keeps the current list visible while the next city payload is in flight", async () => {
    const user = userEvent.setup();
    let resolveCity: (value: BrowsePayload) => void = () => {};
    const pending = new Promise<BrowsePayload>((resolve) => {
      resolveCity = resolve;
    });
    const chicago: BrowsePayload = {
      city: { id: "c2", name: "Chicago", centerLat: 41.8, centerLng: -87.6 },
      cities: payload.cities,
      types: ["bar"],
      areas: [],
      extraTags: [],
      places: [
        {
          id: "p-chi",
          placeId: "ChIJ-chi",
          name: "The Violet Hour",
          lat: 41.9,
          lng: -87.68,
          formattedAddress: "Chicago",
          cityId: "c2",
          areaId: null,
          areaName: null,
          type: "bar",
          extraTags: [],
          notes: "",
          photoName: null,
        },
      ],
    };
    render(
      <BrowseApp
        payload={payload}
        onCityChange={() => pending}
      />,
    );
    await user.selectOptions(screen.getByLabelText("City"), "c2");
    expect(screen.getByText("Slant of Light Books")).toBeInTheDocument();
    expect(screen.queryByText("Add a place to start a city.")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Places" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("City")).toHaveValue("c2");
    resolveCity(chicago);
    expect(await screen.findByText("The Violet Hour")).toBeInTheDocument();
    expect(screen.queryByText("Slant of Light Books")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Places" })).not.toHaveAttribute("aria-busy");
  });
});
