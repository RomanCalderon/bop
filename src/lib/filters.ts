export type PlaceFilterable = {
  name: string;
  formattedAddress: string;
  notes: string;
  type: string | null;
  extraTags: string[];
  areaId: string | null;
  areaName?: string | null;
  lat: number;
  lng: number;
};

export type PlaceFilters = {
  query: string;
  type: string | null;
  areaId: string | null;
  extraTag: string | null;
};

function haystack(place: PlaceFilterable): string {
  return [
    place.name,
    place.formattedAddress,
    place.notes,
    place.type ?? "",
    place.areaName ?? "",
    ...place.extraTags,
  ]
    .join(" ")
    .toLowerCase();
}

export function filterPlaces<T extends PlaceFilterable>(
  places: T[],
  filters: PlaceFilters,
): T[] {
  const q = filters.query.trim().toLowerCase();
  return places.filter((place) => {
    if (q && !haystack(place).includes(q)) return false;
    if (filters.type && place.type !== filters.type) return false;
    if (filters.areaId && place.areaId !== filters.areaId) return false;
    if (filters.extraTag && !place.extraTags.includes(filters.extraTag)) {
      return false;
    }
    return true;
  });
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

export function sortByDistance<T extends { lat: number; lng: number }>(
  places: T[],
  origin: { lat: number; lng: number },
): T[] {
  return [...places].sort(
    (x, y) => haversineKm(origin, x) - haversineKm(origin, y),
  );
}
