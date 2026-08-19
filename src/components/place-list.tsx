"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { haversineKm } from "@/lib/filters";
import type { PlaceIndex } from "@/lib/places-types";

export const PLACE_LIST_PAGE_SIZE = 20;

export function PlaceList({
  places,
  origin,
  empty,
  selectedId,
  onOpen,
}: {
  places: PlaceIndex[];
  origin: { lat: number; lng: number } | null;
  empty: ReactNode;
  selectedId?: string | null;
  onOpen: (place: PlaceIndex) => void;
}) {
  const [limit, setLimit] = useState(PLACE_LIST_PAGE_SIZE);
  const [placeKey, setPlaceKey] = useState(() =>
    places.map((place) => place.id).join(","),
  );
  const nextKey = places.map((place) => place.id).join(",");
  if (nextKey !== placeKey) {
    setPlaceKey(nextKey);
    setLimit(PLACE_LIST_PAGE_SIZE);
  }

  const selectedIndex = selectedId
    ? places.findIndex((place) => place.id === selectedId)
    : -1;
  const visibleCount = Math.min(
    places.length,
    Math.max(limit, selectedIndex + 1),
  );
  const visible = places.slice(0, visibleCount);
  const hasMore = visibleCount < places.length;
  const sentinelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setLimit((n) => n + PLACE_LIST_PAGE_SIZE);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  if (places.length === 0) {
    return <div className="px-4 py-6">{empty}</div>;
  }

  return (
    <ul className="min-h-0 flex-1 overflow-auto">
      {visible.map((place) => {
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
                // Session-gated /api/photos cannot use next/image (optimizer has no cookies).
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/photos?name=${encodeURIComponent(place.photoName)}`}
                  alt=""
                  loading="lazy"
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
      {hasMore ? (
        <li>
          <button
            ref={sentinelRef}
            type="button"
            onClick={() => setLimit((n) => n + PLACE_LIST_PAGE_SIZE)}
            className="w-full px-4 py-3 text-sm text-[var(--muted)] underline-offset-2 transition-colors duration-150 ease-out hover:text-[var(--ink)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ink)]"
          >
            Load more places
          </button>
        </li>
      ) : null}
    </ul>
  );
}
