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
      <button type="button" disabled>
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
