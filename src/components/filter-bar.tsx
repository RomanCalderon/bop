"use client";

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
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-2">
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search places"
        className="w-full rounded-full border border-stone-300 px-3 py-2"
      />
      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onType(type === t ? null : t)}
            className={type === t ? "font-semibold" : ""}
          >
            {t}
          </button>
        ))}
        {areas.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onArea(areaId === a.id ? null : a.id)}
          >
            {a.name}
          </button>
        ))}
        {extraTags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onExtraTag(extraTag === t ? null : t)}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
