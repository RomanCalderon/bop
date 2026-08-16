"use client";

import { haversineKm } from "@/lib/filters";
import type { BrowsePlace } from "@/lib/places-types";

export function PlaceList({
  places,
  origin,
  empty,
  onOpen,
}: {
  places: BrowsePlace[];
  origin: { lat: number; lng: number } | null;
  empty: string;
  onOpen: (place: BrowsePlace) => void;
}) {
  if (places.length === 0) return <p className="px-4 py-6 text-stone-500">{empty}</p>;
  return (
    <ul className="min-h-0 flex-1 overflow-auto">
      {places.map((place) => (
        <li key={place.id}>
          <button
            type="button"
            className="flex w-full gap-3 px-4 py-3 text-left"
            onClick={() => onOpen(place)}
          >
            {place.photoName ? (
              <img
                src={`/api/photos?name=${encodeURIComponent(place.photoName)}`}
                alt=""
                className="h-14 w-14 rounded-lg object-cover"
              />
            ) : (
              <div className="h-14 w-14 rounded-lg bg-stone-300" />
            )}
            <span>
              <span className="block font-medium">{place.name}</span>
              <span className="block text-sm text-stone-500">
                {[place.type, place.areaName, ...place.extraTags]
                  .filter(Boolean)
                  .join(" · ")}
                {origin
                  ? ` · ${haversineKm(origin, place).toFixed(1)} km`
                  : ""}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
