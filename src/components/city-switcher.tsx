"use client";

export function CitySwitcher({
  cities,
  city,
  onChange,
}: {
  cities: { id: string; name: string; placeCount: number }[];
  city: { id: string; name: string } | null;
  onChange: (id: string) => void | Promise<void>;
}) {
  if (cities.length === 0) {
    return (
      <button
        type="button"
        disabled
        className="text-base font-semibold text-[var(--muted)]"
      >
        City
      </button>
    );
  }
  return (
    <label className="text-sm font-semibold">
      <span className="sr-only">City</span>
      <select
        value={city?.id ?? ""}
        onChange={(e) => void onChange(e.target.value)}
        className="bg-transparent text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2"
      >
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
