"use client";

import { useState } from "react";
import type { AutocompleteSuggestion, BrowsePlace } from "@/lib/places-types";

export function AddPlace({
  currentCityId,
  searchPlaces,
  addPlace,
  onClose,
  onSaved,
}: {
  currentCityId: string | null;
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
  onClose: () => void;
  onSaved: (place: BrowsePlace) => void | Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<AutocompleteSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-40 bg-black/40 p-4" role="dialog">
      <div className="mx-auto max-w-lg rounded-2xl bg-[var(--paper)] p-4">
        <div className="flex justify-between">
          <h2 className="text-lg font-semibold">Add place</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <input
          value={q}
          onChange={async (e) => {
            const value = e.target.value;
            setError(null);
            setQ(value);
            if (!value.trim()) {
              setHits([]);
              return;
            }
            const res = await searchPlaces(value);
            if (res.ok) setHits(res.suggestions);
            else {
              setHits([]);
              setError(res.message);
            }
          }}
          placeholder="Search Google places"
          className="mt-3 w-full rounded-full border px-3 py-2"
        />
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        <ul className="mt-3">
          {hits.map((hit) => (
            <li key={hit.placeId}>
              <button
                type="button"
                className="w-full py-2 text-left"
                onClick={async () => {
                  const res = await addPlace(hit.placeId, currentCityId);
                  if (!res.ok) setError(res.message);
                  else await onSaved(res.place);
                }}
              >
                {hit.primaryText}
                <span className="block text-sm text-stone-500">
                  {hit.secondaryText}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
