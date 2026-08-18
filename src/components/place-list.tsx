"use client";

import type { ReactNode } from "react";
import { haversineKm } from "@/lib/filters";
import type { BrowsePlace } from "@/lib/places-types";

export function PlaceList({
  places,
  origin,
  empty,
  selectedId,
  onOpen,
}: {
  places: BrowsePlace[];
  origin: { lat: number; lng: number } | null;
  empty: ReactNode;
  selectedId?: string | null;
  onOpen: (place: BrowsePlace) => void;
}) {
  if (places.length === 0) {
    return <div className="px-4 py-6">{empty}</div>;
  }
  return (
    <ul className="min-h-0 flex-1 overflow-auto">
      {places.map((place) => {
        const selected = place.id === selectedId;
        return (
          <li key={place.id}>
            <button
              type="button"
              aria-current={selected ? "true" : undefined}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ink)] ${
                selected
                  ? "bg-[color-mix(in_srgb,var(--accent)_10%,var(--paper))]"
                  : ""
              }`}
              onClick={() => onOpen(place)}
            >
              {place.photoName ? (
                <img
                  src={`/api/photos?name=${encodeURIComponent(place.photoName)}`}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="h-14 w-14 shrink-0 rounded-lg bg-stone-300" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{place.name}</span>
                <span className="block truncate text-sm text-[var(--muted)]">
                  {[place.type, place.areaName, ...place.extraTags]
                    .filter(Boolean)
                    .join(" · ")}
                  {origin
                    ? ` · ${haversineKm(origin, place).toFixed(1)} km`
                    : ""}
                </span>
              </span>
              {selected ? (
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]"
                />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
