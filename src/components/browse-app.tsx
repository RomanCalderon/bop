"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { filterPlaces, sortByDistance } from "@/lib/filters";
import type { BrowsePayload, BrowsePlace } from "@/lib/places-types";
import { CitySwitcher } from "./city-switcher";
import { FilterBar } from "./filter-bar";
import { MapView } from "./map-view";
import { PlaceList } from "./place-list";

export function BrowseApp({
  payload,
  onCityChange,
  onOpenPlace,
  onAdd,
}: {
  payload: BrowsePayload;
  onCityChange: (cityId: string) => Promise<BrowsePayload>;
  onOpenPlace?: (place: BrowsePlace) => void;
  onAdd?: () => void;
}) {
  const [current, setCurrent] = useState(payload);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [extraTag, setExtraTag] = useState<string | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [geoDenied, setGeoDenied] = useState(false);
  const [prevPayload, setPrevPayload] = useState(payload);
  if (payload !== prevPayload) {
    setPrevPayload(payload);
    setCurrent(payload);
  }

  const filtered = useMemo(() => {
    const next = filterPlaces(current.places, { query, type, areaId, extraTag });
    return origin ? sortByDistance(next, origin) : next;
  }, [current.places, query, type, areaId, extraTag, origin]);

  async function handleCityChange(id: string) {
    try {
      const next = await onCityChange(id);
      setCurrent(next);
      setType(null);
      setAreaId(null);
      setExtraTag(null);
    } catch {
      // keep last-good list
    }
  }

  return (
    <div className="flex min-h-dvh flex-col md:h-dvh">
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <CitySwitcher
          cities={current.cities}
          city={current.city}
          onChange={handleCityChange}
        />
        <div className="flex gap-2">
          {!geoDenied ? (
            <button
              type="button"
              aria-label="Near me"
              onClick={() => {
                navigator.geolocation.getCurrentPosition(
                  (pos) =>
                    setOrigin({
                      lat: pos.coords.latitude,
                      lng: pos.coords.longitude,
                    }),
                  () => setGeoDenied(true),
                );
              }}
            >
              Near me
            </button>
          ) : null}
          <button type="button" aria-label="Add place" onClick={() => onAdd?.()}>
            +
          </button>
          <Link href="/settings">Settings</Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="h-[40vh] md:order-2 md:h-auto md:flex-1">
          <MapView
            city={current.city}
            places={filtered}
            markerIds={filtered.map((p) => p.id)}
            onSelect={(id) => {
              const place = filtered.find((p) => p.id === id);
              if (place) onOpenPlace?.(place);
            }}
          />
        </div>

        <section className="flex min-h-0 flex-1 flex-col md:order-1 md:w-[28rem] md:border-r md:border-stone-300">
          <FilterBar
            query={query}
            onQuery={setQuery}
            types={current.types}
            type={type}
            onType={setType}
            areas={current.areas}
            areaId={areaId}
            onArea={setAreaId}
            extraTags={current.extraTags}
            extraTag={extraTag}
            onExtraTag={setExtraTag}
          />
          <PlaceList
            places={filtered}
            origin={origin}
            empty={
              current.city === null
                ? "Add a place to start a city."
                : "Nothing matches — clear filters."
            }
            onOpen={(place) => onOpenPlace?.(place)}
          />
        </section>
      </div>
    </div>
  );
}
