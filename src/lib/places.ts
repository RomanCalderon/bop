import "server-only";

import type {
  AutocompleteSuggestion,
  PlaceDetails,
  PlacesPort,
  PhotoAttribution,
  TextSearchHit,
} from "./places-types";

const AUTOCOMPLETE_MASK =
  "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat";
const TEXT_MASK = "places.id,places.displayName,places.formattedAddress";
const DETAILS_MASK =
  "id,displayName,location,formattedAddress,addressComponents,primaryType,rating,googleMapsUri,photos";

function attributions(
  raw: { displayName?: string; uri?: string }[] | undefined,
): PhotoAttribution[] {
  return (raw ?? []).map((a) => ({
    displayName: a.displayName ?? "",
    uri: a.uri ? a.uri : null,
  }));
}

async function googleFetch(
  url: string,
  init: RequestInit,
  retries = 1,
): Promise<Response> {
  try {
    const res = await fetch(url, init);
    if (res.ok) return res;
  } catch {
    if (retries > 0) return googleFetch(url, init, retries - 1);
    throw new Error("places_api_error");
  }
  if (retries > 0) return googleFetch(url, init, retries - 1);
  throw new Error("places_api_error");
}

export function createPlacesClient(apiKey: string): PlacesPort {
  const headers = (mask: string) => ({
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
    "X-Goog-FieldMask": mask,
  });

  return {
    async autocomplete(input: string): Promise<AutocompleteSuggestion[]> {
      const res = await googleFetch(
        "https://places.googleapis.com/v1/places:autocomplete",
        {
          method: "POST",
          headers: headers(AUTOCOMPLETE_MASK),
          body: JSON.stringify({ input }),
        },
      );
      const json = (await res.json()) as {
        suggestions?: {
          placePrediction?: {
            placeId?: string;
            structuredFormat?: {
              mainText?: { text?: string };
              secondaryText?: { text?: string };
            };
          };
        }[];
      };
      return (json.suggestions ?? [])
        .map((s) => s.placePrediction)
        .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
        .map((p) => ({
          placeId: p.placeId!,
          primaryText: p.structuredFormat?.mainText?.text ?? "",
          secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
        }));
    },

    async textSearch(query: string): Promise<TextSearchHit[]> {
      const res = await googleFetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: headers(TEXT_MASK),
          body: JSON.stringify({ textQuery: query }),
        },
      );
      const json = (await res.json()) as {
        places?: {
          id?: string;
          displayName?: { text?: string };
          formattedAddress?: string;
        }[];
      };
      return (json.places ?? [])
        .filter((p) => p.id)
        .map((p) => ({
          placeId: p.id!,
          name: p.displayName?.text ?? "",
          formattedAddress: p.formattedAddress ?? "",
        }));
    },

    async getDetails(placeId: string): Promise<PlaceDetails | null> {
      let res: Response;
      try {
        res = await googleFetch(
          `https://places.googleapis.com/v1/places/${placeId}`,
          { headers: headers(DETAILS_MASK) },
        );
      } catch {
        return null;
      }
      const json = (await res.json()) as {
        id?: string;
        displayName?: { text?: string };
        location?: { latitude?: number; longitude?: number };
        formattedAddress?: string;
        addressComponents?: {
          longText?: string;
          long_name?: string;
          types?: string[];
        }[];
        primaryType?: string;
        rating?: number;
        googleMapsUri?: string;
        photos?: {
          name?: string;
          authorAttributions?: { displayName?: string; uri?: string }[];
        }[];
      };
      if (!json.id || json.location?.latitude == null || json.location.longitude == null) {
        return null;
      }
      const photo = json.photos?.[0];
      return {
        placeId: json.id,
        name: json.displayName?.text ?? "",
        lat: json.location.latitude,
        lng: json.location.longitude,
        formattedAddress: json.formattedAddress ?? "",
        addressComponents: (json.addressComponents ?? []).map((c) => ({
          types: c.types ?? [],
          longText: c.longText ?? c.long_name ?? "",
        })),
        primaryType: json.primaryType ?? null,
        rating: json.rating ?? null,
        googleMapsUri: json.googleMapsUri ?? "",
        photoName: photo?.name ?? null,
        authorAttributions: attributions(photo?.authorAttributions),
      };
    },

    async fetchPhoto(photoName: string) {
      let res: Response;
      try {
        res = await googleFetch(
          `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=800&skipHttpRedirect=true`,
          { headers: { "X-Goog-Api-Key": apiKey } },
        );
      } catch {
        return null;
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const json = (await res.json()) as { photoUri?: string };
        if (!json.photoUri) return null;
        const img = await fetch(json.photoUri);
        if (!img.ok) return null;
        return {
          bytes: new Uint8Array(await img.arrayBuffer()),
          contentType: img.headers.get("content-type") ?? "image/jpeg",
        };
      }
      return {
        bytes: new Uint8Array(await res.arrayBuffer()),
        contentType: contentType || "image/jpeg",
      };
    },
  };
}
