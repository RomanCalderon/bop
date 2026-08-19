import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { BrowsePlace } from "@/lib/places-types";
import { PLACE_LIST_PAGE_SIZE, PlaceList } from "./place-list";

function fakePlace(index: number): BrowsePlace {
  return {
    id: `p${index}`,
    placeId: `ChIJ${index}`,
    name: `Place ${index}`,
    lat: 30.27,
    lng: -97.74,
    formattedAddress: "Austin",
    cityId: "c1",
    areaId: null,
    areaName: null,
    type: "cafe",
    extraTags: [],
    notes: "",
    rating: null,
    googleMapsUrl: "https://maps.google.com/?cid=1",
    photoName: null,
    authorAttributions: [],
  };
}

describe("PlaceList", () => {
  it("renders the first page and loads more when asked", async () => {
    const user = userEvent.setup();
    const places = Array.from({ length: PLACE_LIST_PAGE_SIZE + 5 }, (_, i) =>
      fakePlace(i + 1),
    );
    render(
      <PlaceList places={places} origin={null} empty={null} onOpen={() => {}} />,
    );
    expect(screen.getByText("Place 1")).toBeInTheDocument();
    expect(screen.getByText(`Place ${PLACE_LIST_PAGE_SIZE}`)).toBeInTheDocument();
    expect(
      screen.queryByText(`Place ${PLACE_LIST_PAGE_SIZE + 1}`),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more places" }));
    expect(
      screen.getByText(`Place ${PLACE_LIST_PAGE_SIZE + 1}`),
    ).toBeInTheDocument();
  });

  it("keeps a selected place visible even when it is past the first page", () => {
    const places = Array.from({ length: PLACE_LIST_PAGE_SIZE + 2 }, (_, i) =>
      fakePlace(i + 1),
    );
    const last = places.at(-1)!;
    render(
      <PlaceList
        places={places}
        origin={null}
        empty={null}
        selectedId={last.id}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText(last.name)).toBeInTheDocument();
  });
});
