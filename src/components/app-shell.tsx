"use client";

import { useRef, useState } from "react";
import type { AutocompleteSuggestion, BrowsePayload, BrowsePlace } from "@/lib/places-types";
import { AddPlace } from "./add-place";
import { BrowseApp } from "./browse-app";
import { PlaceDetail } from "./place-detail";
import { Toast } from "./toast";

export type CityChangeResult = BrowsePayload | { ok: false; message: string };

export type AppShellActions = {
  initial: BrowsePayload;
  onCityChange: (cityId: string) => Promise<CityChangeResult>;
  searchPlaces: (
    input: string,
  ) => Promise<
    | { ok: true; suggestions: AutocompleteSuggestion[] }
    | { ok: false; message: string }
  >;
  addPlace: (
    placeId: string,
    currentCityId: string | null,
  ) => Promise<
    | { ok: true; place: BrowsePlace; created: boolean }
    | { ok: false; message: string }
  >;
  updatePlace: (
    id: string,
    patch: {
      notes?: string;
      extraTags?: string[];
      type?: string | null;
      areaId?: string | null;
      cityId?: string;
    },
  ) => Promise<{ ok: true; place: BrowsePlace } | { ok: false; message: string }>;
  deletePlace: (id: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  movePlace: (
    id: string,
    toCityId: string,
  ) => Promise<
    | { ok: true; place: BrowsePlace }
    | { ok: false; message: string; existingPlaceId?: string }
  >;
  createArea: (
    cityId: string,
    name: string,
  ) => Promise<
    | { ok: true; area: { id: string; name: string } }
    | { ok: false; message: string }
  >;
};

function isCityChangeFailure(
  result: CityChangeResult,
): result is { ok: false; message: string } {
  return "ok" in result && result.ok === false;
}

function payloadFromFirstPlace(place: BrowsePlace): BrowsePayload {
  const name = place.formattedAddress.split(",")[0]?.trim() || "City";
  return {
    city: {
      id: place.cityId,
      name,
      centerLat: place.lat,
      centerLng: place.lng,
    },
    cities: [{ id: place.cityId, name, placeCount: 1 }],
    places: [place],
    types: place.type ? [place.type] : [],
    areas:
      place.areaId && place.areaName
        ? [{ id: place.areaId, name: place.areaName }]
        : [],
    extraTags: [...place.extraTags],
  };
}

export function AppShell(props: AppShellActions) {
  const [payload, setPayload] = useState(props.initial);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const [selected, setSelected] = useState<BrowsePlace | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function loadCity(cityId: string): Promise<BrowsePayload | null> {
    try {
      const next = await props.onCityChange(cityId);
      if (isCityChangeFailure(next)) return null;
      return next;
    } catch {
      return null;
    }
  }

  function mergePlace(prev: BrowsePayload, place: BrowsePlace): BrowsePayload {
    const exists = prev.places.some((p) => p.id === place.id);
    const places = exists
      ? prev.places.map((p) => (p.id === place.id ? place : p))
      : [...prev.places, place];
    return {
      ...prev,
      places,
      types: [...new Set([...prev.types, place.type].filter((t): t is string => Boolean(t)))],
      extraTags: [...new Set([...prev.extraTags, ...place.extraTags])],
    };
  }

  function upsertPlace(place: BrowsePlace) {
    setPayload((prev) => mergePlace(prev, place));
  }

  async function handleSaved(place: BrowsePlace) {
    setAdding(false);
    const viewed = payloadRef.current.city?.id ?? null;
    if (viewed === place.cityId) {
      upsertPlace(place);
      return;
    }
    const next = await loadCity(place.cityId);
    if (next) {
      setPayload(next);
      return;
    }
    if (!viewed) setPayload(payloadFromFirstPlace(place));
  }

  async function handleChanged(place: BrowsePlace) {
    const viewed = payloadRef.current.city?.id;
    if (viewed && place.cityId !== viewed) {
      const next = await loadCity(viewed);
      if (next) setPayload(next);
      else {
        setPayload((prev) => ({
          ...prev,
          places: prev.places.filter((p) => p.id !== place.id),
        }));
      }
      setSelected(place);
      return;
    }
    upsertPlace(place);
    setSelected(place);
  }

  async function openExistingPlace(existingPlaceId: string, cityId: string) {
    const inView = payloadRef.current.places.find((p) => p.id === existingPlaceId);
    if (inView) {
      setSelected(inView);
      return;
    }
    const next = await loadCity(cityId);
    if (!next) return;
    setPayload(next);
    const existing = next.places.find((p) => p.id === existingPlaceId);
    if (existing) setSelected(existing);
  }

  return (
    <>
      <BrowseApp
        payload={payload}
        onCityChange={async (id) => {
          const next = await props.onCityChange(id);
          if (isCityChangeFailure(next)) {
            throw new Error(next.message);
          }
          setPayload(next);
          return next;
        }}
        onOpenPlace={setSelected}
        onAdd={() => setAdding(true)}
      />
      {adding ? (
        <AddPlace
          currentCityId={payload.city?.id ?? null}
          searchPlaces={props.searchPlaces}
          addPlace={props.addPlace}
          onClose={() => setAdding(false)}
          onSaved={handleSaved}
        />
      ) : null}
      {selected ? (
        <PlaceDetail
          key={selected.id}
          place={selected}
          cities={payload.cities}
          areas={payload.areas}
          updatePlace={props.updatePlace}
          deletePlace={props.deletePlace}
          movePlace={async (id, toCityId) => {
            const result = await props.movePlace(id, toCityId);
            if (!result.ok && result.existingPlaceId) {
              void openExistingPlace(result.existingPlaceId, toCityId);
            }
            return result;
          }}
          createArea={async (cityId, name) => {
            const result = await props.createArea(cityId, name);
            if (result.ok) {
              setPayload((prev) => {
                const exists = prev.areas.some((a) => a.id === result.area.id);
                const areas = exists
                  ? prev.areas.map((a) => (a.id === result.area.id ? result.area : a))
                  : [...prev.areas, result.area];
                return { ...prev, areas };
              });
            }
            return result;
          }}
          onClose={() => setSelected(null)}
          onChanged={(place) => {
            void handleChanged(place);
          }}
          onDeleted={(id) => {
            setPayload((prev) => ({
              ...prev,
              places: prev.places.filter((p) => p.id !== id),
            }));
            setSelected(null);
          }}
          onError={setToast}
        />
      ) : null}
      {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
    </>
  );
}
