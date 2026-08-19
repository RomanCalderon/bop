"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { filterPlaces, sortByDistance } from "@/lib/filters";
import type { BrowsePayload, PlaceIndex } from "@/lib/places-types";
import { PlaceListSkeleton } from "./browse-skeleton";
import { CitySwitcher } from "./city-switcher";
import { FilterBar } from "./filter-bar";
import { MoreIcon, NearMeIcon, PlusIcon } from "./icons";
import { MapView } from "./map-view";
import { PlaceList } from "./place-list";

const iconBtn =
  "flex h-9 w-9 items-center justify-center rounded-full transition-[color,box-shadow,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)] active:scale-[0.98]";

export function BrowseApp({
  payload,
  onCityChange,
  onOpenPlace,
  onAdd,
  selectedPlaceId = null,
}: {
  payload: BrowsePayload;
  onCityChange: (cityId: string) => Promise<BrowsePayload>;
  onOpenPlace?: (place: PlaceIndex) => void;
  onAdd?: () => void;
  selectedPlaceId?: string | null;
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
  const [pendingCityId, setPendingCityId] = useState<string | null>(null);
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
    setPendingCityId(id);
    try {
      const next = await onCityChange(id);
      setCurrent(next);
      setType(null);
      setAreaId(null);
      setExtraTag(null);
      setPendingCityId(null);
    } catch {
      setPendingCityId(null);
    }
  }

  function clearAllFilters() {
    setQuery("");
    setType(null);
    setAreaId(null);
    setExtraTag(null);
  }

  return (
    <div className="grid min-h-dvh grid-rows-[auto_40vh_auto_minmax(0,1fr)] md:h-dvh md:grid-cols-[28rem_minmax(0,1fr)] md:grid-rows-[auto_auto_minmax(0,1fr)]">
      <header className="flex items-center justify-between gap-2 px-4 py-3 md:col-start-1 md:row-start-1 md:border-r md:border-stone-300">
        <CitySwitcher
          cities={current.cities}
          city={
            pendingCityId
              ? {
                  id: pendingCityId,
                  name:
                    current.cities.find((c) => c.id === pendingCityId)?.name ??
                    current.city?.name ??
                    "",
                }
              : current.city
          }
          onChange={handleCityChange}
        />
        <div className="flex items-center gap-2">
          {!geoDenied ? (
            <button
              type="button"
              aria-label="Near me"
              className={`${iconBtn} bg-[color-mix(in_srgb,var(--ink)_6%,var(--paper))] text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--ink)_10%,var(--paper))]`}
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
              <NearMeIcon className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Add place"
            className={`${iconBtn} bg-[var(--ink)] text-[var(--paper)] hover:opacity-90`}
            onClick={() => onAdd?.()}
          >
            <PlusIcon className="h-4 w-4" />
          </button>
          <Link
            href="/settings"
            aria-label="Settings"
            className={`${iconBtn} bg-[color-mix(in_srgb,var(--ink)_6%,var(--paper))] text-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--ink)_10%,var(--paper))]`}
          >
            <MoreIcon className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div
        className="h-full min-h-0 md:col-start-2 md:row-span-3 md:row-start-1"
        aria-busy={pendingCityId ? true : undefined}
      >
        <MapView
          city={current.city}
          places={filtered}
          markerIds={filtered.map((p) => p.id)}
          selectedPlaceId={selectedPlaceId}
          onSelect={(id) => {
            const place = filtered.find((p) => p.id === id);
            if (place) onOpenPlace?.(place);
          }}
        />
      </div>

      <div className="md:col-start-1 md:row-start-2 md:border-r md:border-stone-300">
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
          matchCount={filtered.length}
          onClearAll={clearAllFilters}
        />
      </div>

      <section
        aria-label="Places"
        aria-busy={pendingCityId ? true : undefined}
        className="flex min-h-0 flex-col md:col-start-1 md:row-start-3 md:border-r md:border-stone-300"
      >
        <PlaceList
          places={filtered}
          origin={origin}
          selectedId={selectedPlaceId}
          empty={
            pendingCityId ? (
              <PlaceListSkeleton />
            ) : current.city === null ? (
              <EmptyCity onAdd={onAdd} />
            ) : (
              <NoMatchEmpty onClear={clearAllFilters} />
            )
          }
          onOpen={(place) => onOpenPlace?.(place)}
        />
      </section>
    </div>
  );
}

function EmptyCity({ onAdd }: { onAdd?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-[var(--muted)]">Add a place to start a city.</p>
      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="rounded-full bg-[var(--ink)] px-4 py-2 text-[var(--paper)] transition-[transform,box-shadow] duration-150 ease-out hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          + Add a place
        </button>
      ) : null}
    </div>
  );
}

function NoMatchEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-[var(--muted)]">No saved place matches this search.</p>
      <button
        type="button"
        onClick={onClear}
        className="rounded-full border border-[var(--accent)] px-4 py-2 text-[var(--accent)] transition-[transform,box-shadow] duration-150 ease-out hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--paper))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 active:scale-[0.98]"
      >
        Nothing matches — clear filters.
      </button>
    </div>
  );
}
