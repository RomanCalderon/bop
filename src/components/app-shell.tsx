"use client";

import { useState } from "react";
import type { AutocompleteSuggestion, BrowsePayload, BrowsePlace } from "@/lib/places-types";
import { AddPlace } from "./add-place";
import { BrowseApp } from "./browse-app";
import { PlaceDetail } from "./place-detail";
import { Toast } from "./toast";

export type AppShellActions = {
  initial: BrowsePayload;
  onCityChange: (cityId: string) => Promise<BrowsePayload>;
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

export function AppShell(props: AppShellActions) {
  const [payload, setPayload] = useState(props.initial);
  const [selected, setSelected] = useState<BrowsePlace | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function upsertPlace(place: BrowsePlace) {
    setPayload((prev) => {
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
    });
  }

  return (
    <>
      <BrowseApp
        payload={payload}
        onCityChange={async (id) => {
          const next = await props.onCityChange(id);
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
          onSaved={(place) => {
            upsertPlace(place);
            setAdding(false);
          }}
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
          movePlace={props.movePlace}
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
            upsertPlace(place);
            setSelected(place);
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
