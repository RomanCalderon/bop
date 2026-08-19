"use client";

import { useEffect, useId, useState } from "react";
import { hasCardFields, type BrowsePlace, type PlaceIndex } from "@/lib/places-types";
import { ChevronIcon, CloseIcon } from "./icons";

const ring =
  "transition-[color,box-shadow,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sheet)]";

export function PlaceDetail({
  place,
  cardStatus,
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
  place: PlaceIndex | BrowsePlace;
  cardStatus: "pending" | "ready";
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
  const titleId = useId();
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(place.notes);
  const [tags, setTags] = useState(place.extraTags.join(", "));
  const [type, setType] = useState(place.type ?? "");
  const [brokenPhoto, setBrokenPhoto] = useState(false);
  const attribution =
    hasCardFields(place) && place.authorAttributions.length
      ? place.authorAttributions
          .map((a) => a.displayName)
          .filter(Boolean)
          .join(", ")
      : "";
  const mapsClassName = `${ring} mt-5 block rounded-full bg-[var(--ink)] px-4 py-3 text-center text-[var(--paper)] hover:opacity-90`;
  const mapsPending =
    cardStatus === "pending" || !hasCardFields(place) || !place.googleMapsUrl;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Dismiss"
        className="bop-fade fixed inset-0 z-40 bg-black/40 md:hidden"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col overflow-hidden rounded-t-[24px] bg-[var(--sheet)] shadow-xl md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-none md:w-[28rem] md:rounded-none md:border-l md:border-stone-300"
      >
        <div className="bop-sheet-enter relative flex min-h-0 flex-1 flex-col overflow-auto">
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={onClose}
            className="absolute left-1/2 top-2 z-10 h-1 w-9 -translate-x-1/2 rounded-full bg-white/80 shadow-sm md:hidden"
          />
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`${ring} absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--sheet)_88%,white)] shadow-sm hover:bg-[var(--sheet)]`}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
          {place.photoName && !brokenPhoto ? (
            <img
              src={`/api/photos?name=${encodeURIComponent(place.photoName)}`}
              alt=""
              className="h-64 w-full object-cover md:h-72"
              onError={() => setBrokenPhoto(true)}
            />
          ) : (
            <div className="h-64 bg-stone-300 md:h-72" />
          )}
          <div className="p-4 pt-3">
          {attribution ? (
            <p className="text-xs text-[var(--muted)]">Photo: {attribution}</p>
          ) : null}
          <h2 id={titleId} className="mt-2 text-xl font-semibold text-balance">
            {place.name}
          </h2>
          <p className="text-sm text-[var(--muted)]">
            {[
              place.type,
              place.areaName,
              hasCardFields(place) && place.rating != null
                ? `${place.rating} ★`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {place.extraTags.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {place.extraTags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full bg-[color-mix(in_srgb,var(--ink)_8%,var(--sheet))] px-3 py-1 text-sm"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
          {place.notes ? (
            <section className="mt-4" aria-labelledby={`${titleId}-notes`}>
              <h3
                id={`${titleId}-notes`}
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]"
              >
                Shared notes
              </h3>
              <p className="mt-1 max-w-prose text-sm leading-relaxed">{place.notes}</p>
            </section>
          ) : null}
          {hasCardFields(place) && !mapsPending ? (
            <a
              href={place.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className={mapsClassName}
            >
              Open in Google Maps
            </a>
          ) : (
            <button
              type="button"
              aria-busy="true"
              aria-label="Open in Google Maps"
              className={mapsClassName}
              disabled
            >
              Open in Google Maps
            </button>
          )}
          <button
            type="button"
            aria-expanded={editing}
            onClick={() => setEditing((open) => !open)}
            className={`${ring} mt-3 inline-flex w-full items-center justify-center gap-1 rounded-full border border-stone-400 px-4 py-2 text-sm hover:border-[var(--ink)]`}
          >
            Edit
            <ChevronIcon className={`h-4 w-4 transition-transform duration-150 ${editing ? "rotate-180" : ""}`} />
          </button>
          {editing ? (
            <div className="mt-4 border-t border-stone-200 pt-4">
              <label className="mt-0 block text-sm">
                Notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${ring} mt-1 w-full rounded-lg border border-stone-300 bg-[var(--paper)] p-2`}
                />
              </label>
              <label className="mt-2 block text-sm">
                Extra tags
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className={`${ring} mt-1 w-full rounded-lg border border-stone-300 bg-[var(--paper)] p-2`}
                />
              </label>
              <label className="mt-2 block text-sm">
                Type
                <input
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={`${ring} mt-1 w-full rounded-lg border border-stone-300 bg-[var(--paper)] p-2`}
                />
              </label>
              <label className="mt-2 block text-sm">
                Area
                <select
                  defaultValue={place.areaId ?? ""}
                  onChange={async (e) => {
                    const res = await updatePlace(place.id, {
                      areaId: e.target.value || null,
                    });
                    if (res.ok) onChanged(res.place);
                    else onError(res.message);
                  }}
                  className={`${ring} mt-1 w-full rounded-lg border border-stone-300 bg-[var(--paper)] p-2`}
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
                className={`${ring} mt-2 text-sm underline`}
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
                  className={`${ring} mt-1 w-full rounded-lg border border-stone-300 bg-[var(--paper)] p-2`}
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
                className={`${ring} mt-4 rounded-full bg-[var(--ink)] px-4 py-2 text-[var(--paper)]`}
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
                className={`${ring} mt-2 block text-sm text-red-700`}
                onClick={async () => {
                  const res = await deletePlace(place.id);
                  if (res.ok) onDeleted(place.id);
                  else onError(res.message);
                }}
              >
                Delete
              </button>
            </div>
          ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
