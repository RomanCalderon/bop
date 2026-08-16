"use client";

import { useState } from "react";
import type { BrowsePlace } from "@/lib/places-types";

export function PlaceDetail({
  place,
  cities,
  areas,
  updatePlace,
  deletePlace,
  movePlace,
  createArea,
  onClose,
  onChanged,
  onDeleted,
  onError,
}: {
  place: BrowsePlace;
  cities: { id: string; name: string }[];
  areas: { id: string; name: string }[];
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
  onClose: () => void;
  onChanged: (place: BrowsePlace) => void;
  onDeleted: (id: string) => void;
  onError: (message: string) => void;
}) {
  const [notes, setNotes] = useState(place.notes);
  const [tags, setTags] = useState(place.extraTags.join(", "));
  const [type, setType] = useState(place.type ?? "");
  const [brokenPhoto, setBrokenPhoto] = useState(false);
  const attribution = place.authorAttributions
    .map((a) => a.displayName)
    .filter(Boolean)
    .join(", ");

  return (
    <div
      role="dialog"
      className="fixed inset-x-0 bottom-0 z-40 max-h-[80vh] overflow-auto rounded-t-2xl bg-[var(--paper)] p-4 shadow-xl md:inset-y-0 md:right-0 md:left-auto md:h-full md:w-[28rem] md:rounded-none"
    >
      <button type="button" onClick={onClose}>
        Close
      </button>
      {place.photoName && !brokenPhoto ? (
        <img
          src={`/api/photos?name=${encodeURIComponent(place.photoName)}`}
          alt=""
          className="mt-3 h-40 w-full rounded-xl object-cover"
          onError={() => setBrokenPhoto(true)}
        />
      ) : (
        <div className="mt-3 h-40 rounded-xl bg-stone-300" />
      )}
      {attribution ? <p className="mt-1 text-xs">Photo: {attribution}</p> : null}
      <h2 className="mt-3 text-xl font-semibold">{place.name}</h2>
      <p className="text-sm text-stone-500">
        {[place.type, place.areaName, place.rating].filter(Boolean).join(" · ")}
      </p>
      <a href={place.googleMapsUrl} target="_blank" rel="noreferrer" className="underline">
        Open in Google Maps
      </a>
      <label className="mt-4 block text-sm">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-lg border p-2"
        />
      </label>
      <label className="mt-2 block text-sm">
        Extra tags
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="mt-1 w-full rounded-lg border p-2"
        />
      </label>
      <label className="mt-2 block text-sm">
        Type
        <input
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="mt-1 w-full rounded-lg border p-2"
        />
      </label>
      <label className="mt-2 block text-sm">
        Area
        <select
          defaultValue={place.areaId ?? ""}
          onChange={async (e) => {
            const res = await updatePlace(place.id, { areaId: e.target.value || null });
            if (res.ok) onChanged(res.place);
            else onError(res.message);
          }}
        >
          <option value="">None</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="mt-2 text-sm underline"
        onClick={async () => {
          const name = window.prompt("New area");
          if (!name) return;
          const created = await createArea(place.cityId, name);
          if (!created.ok) return onError(created.message);
          const res = await updatePlace(place.id, { areaId: created.area.id });
          if (res.ok) onChanged(res.place);
          else onError(res.message);
        }}
      >
        New area
      </button>
      <label className="mt-2 block text-sm">
        City
        <select
          defaultValue={place.cityId}
          onChange={async (e) => {
            const res = await movePlace(place.id, e.target.value);
            if (res.ok) onChanged(res.place);
            else onError(res.message);
          }}
        >
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="mt-4 rounded-full bg-[var(--ink)] px-4 py-2 text-[var(--paper)]"
        onClick={async () => {
          const res = await updatePlace(place.id, {
            notes,
            extraTags: tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            type: type || null,
          });
          if (res.ok) onChanged(res.place);
          else onError(res.message);
        }}
      >
        Save
      </button>
      <button
        type="button"
        className="mt-2 block text-sm text-red-700"
        onClick={async () => {
          const res = await deletePlace(place.id);
          if (res.ok) onDeleted(place.id);
          else onError(res.message);
        }}
      >
        Delete
      </button>
    </div>
  );
}
