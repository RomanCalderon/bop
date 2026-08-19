"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { CloseIcon, SearchIcon, SlidersIcon } from "./icons";

const ring =
  "transition-[color,box-shadow,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]";

function Chip({
  label,
  selected,
  onToggle,
  dismissible,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  dismissible?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`${ring} inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm active:scale-[0.98] ${
        selected
          ? "bg-[var(--accent)] text-[var(--paper)]"
          : "bg-[color-mix(in_srgb,var(--ink)_8%,var(--paper))] text-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--ink)_12%,var(--paper))]"
      }`}
    >
      {label}
      {dismissible ? (
        <CloseIcon className="h-3 w-3" />
      ) : null}
    </button>
  );
}

export function FilterBar({
  query,
  onQuery,
  types,
  type,
  onType,
  areas,
  areaId,
  onArea,
  extraTags,
  extraTag,
  onExtraTag,
  matchCount,
  onClearAll,
}: {
  query: string;
  onQuery: (q: string) => void;
  types: string[];
  type: string | null;
  onType: (t: string | null) => void;
  areas: { id: string; name: string }[];
  areaId: string | null;
  onArea: (id: string | null) => void;
  extraTags: string[];
  extraTag: string | null;
  onExtraTag: (t: string | null) => void;
  matchCount: number;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const searchId = useId();
  const selectedArea = areas.find((a) => a.id === areaId) ?? null;
  const chipCount = [type, areaId, extraTag].filter(Boolean).length;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative flex flex-col gap-2 px-4 py-2">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={searchId} className="sr-only">
            Search places
          </label>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            id={searchId}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search places"
            className={`${ring} w-full rounded-full border border-stone-300 bg-[var(--sheet)] py-2 pl-9 pr-9 text-[var(--ink)] placeholder:text-[var(--muted)]`}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onQuery("")}
              className={`${ring} absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--ink)]`}
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Filters"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className={`${ring} relative inline-flex shrink-0 items-center gap-1.5 rounded-full border border-stone-300 bg-[var(--sheet)] px-3 py-2 text-sm hover:border-stone-400 active:scale-[0.98]`}
        >
          <SlidersIcon className="h-4 w-4" />
          Filters
          {chipCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold text-[var(--paper)]">
              {chipCount}
            </span>
          ) : null}
        </button>
      </div>

      {!open && chipCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {type ? (
            <Chip label={type} selected dismissible onToggle={() => onType(null)} />
          ) : null}
          {selectedArea ? (
            <Chip
              label={selectedArea.name}
              selected
              dismissible
              onToggle={() => onArea(null)}
            />
          ) : null}
          {extraTag ? (
            <Chip
              label={extraTag}
              selected
              dismissible
              onToggle={() => onExtraTag(null)}
            />
          ) : null}
          <button
            type="button"
            onClick={onClearAll}
            className={`${ring} ml-auto text-sm text-[var(--muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline`}
          >
            Clear
          </button>
        </div>
      ) : null}

      {open ? (
        <>
          <button
            type="button"
            aria-label="Dismiss"
            className="bop-fade fixed inset-0 z-30 bg-black/40 md:bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="bop-sheet-up fixed inset-x-0 bottom-0 z-40 flex max-h-[80vh] flex-col rounded-t-[24px] bg-[var(--sheet)] p-4 shadow-xl md:absolute md:inset-x-4 md:bottom-auto md:top-full md:mt-2 md:max-h-[min(80vh,32rem)] md:rounded-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id={titleId} className="text-lg font-semibold">
                Filters
              </h2>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setOpen(false)}
                className={`${ring} flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ink)_8%,var(--sheet))] hover:bg-[color-mix(in_srgb,var(--ink)_12%,var(--sheet))]`}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-auto">
              {types.length > 0 ? (
                <FilterGroup label="Type">
                  {types.map((t) => (
                    <Chip
                      key={t}
                      label={t}
                      selected={type === t}
                      onToggle={() => onType(type === t ? null : t)}
                    />
                  ))}
                </FilterGroup>
              ) : null}
              {areas.length > 0 ? (
                <FilterGroup label="Area">
                  {areas.map((a) => (
                    <Chip
                      key={a.id}
                      label={a.name}
                      selected={areaId === a.id}
                      onToggle={() => onArea(areaId === a.id ? null : a.id)}
                    />
                  ))}
                </FilterGroup>
              ) : null}
              {extraTags.length > 0 ? (
                <FilterGroup label="Tags">
                  {extraTags.map((t) => (
                    <Chip
                      key={t}
                      label={t}
                      selected={extraTag === t}
                      onToggle={() => onExtraTag(extraTag === t ? null : t)}
                    />
                  ))}
                </FilterGroup>
              ) : null}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-stone-200 pt-3">
              <p className="text-sm text-[var(--muted)]">
                {matchCount} {matchCount === 1 ? "place matches" : "places match"}
              </p>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                }}
                className={`${ring} rounded-full border border-stone-300 px-3 py-1.5 text-sm hover:border-stone-400`}
              >
                Clear filters
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={label}>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}
