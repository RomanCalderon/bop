import type { AddressComponent } from "./places-types";

function firstOf(
  components: AddressComponent[],
  type: string,
): string | null {
  const hit = components.find((c) => c.types.includes(type));
  return hit?.longText ?? null;
}

export function inferCityName(
  components: AddressComponent[],
): string | null {
  return (
    firstOf(components, "locality") ??
    firstOf(components, "administrative_area_level_1")
  );
}

export function inferAreaName(
  components: AddressComponent[],
): string | null {
  return (
    firstOf(components, "neighborhood") ??
    firstOf(components, "sublocality") ??
    firstOf(components, "sublocality_level_1")
  );
}

export function displayType(primaryType: string | null): string | null {
  if (!primaryType) return null;
  return primaryType.replaceAll("_", " ");
}
