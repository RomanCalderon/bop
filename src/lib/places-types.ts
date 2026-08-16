export type AddressComponent = {
  types: string[];
  longText: string;
};

export type PhotoAttribution = {
  displayName: string;
  uri: string | null;
};

export type PlaceDetails = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  formattedAddress: string;
  addressComponents: AddressComponent[];
  primaryType: string | null;
  rating: number | null;
  googleMapsUri: string;
  photoName: string | null;
  authorAttributions: PhotoAttribution[];
};

export type AutocompleteSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

export type TextSearchHit = {
  placeId: string;
  name: string;
  formattedAddress: string;
};

export type PlacesPort = {
  autocomplete(input: string): Promise<AutocompleteSuggestion[]>;
  textSearch(query: string): Promise<TextSearchHit[]>;
  getDetails(placeId: string): Promise<PlaceDetails | null>;
  fetchPhoto(
    photoName: string,
  ): Promise<{ bytes: Uint8Array; contentType: string } | null>;
};

export type CityPolicy =
  | { type: "in-app"; currentCityId: string }
  | { type: "seed" };

export type InsertPlaceInput = {
  details: PlaceDetails;
  notes: string;
  extraTags?: string[];
  seedFeatureCid?: string | null;
  cityPolicy: CityPolicy;
};

export type PlaceRow = {
  id: string;
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  formattedAddress: string;
  cityId: string;
  areaId: string | null;
  type: string | null;
  extraTags: string[];
  notes: string;
  rating: number | null;
  googleMapsUrl: string;
  photoName: string | null;
  authorAttributions: PhotoAttribution[];
  seedFeatureCid: string | null;
};

export type InsertPlaceResult =
  | { ok: true; place: PlaceRow; created: boolean }
  | { ok: false; reason: "city_inference_failed" };

export type BrowsePlace = PlaceRow & {
  areaName: string | null;
};

export type BrowsePayload = {
  city: {
    id: string;
    name: string;
    centerLat: number | null;
    centerLng: number | null;
  } | null;
  cities: { id: string; name: string; placeCount: number }[];
  places: BrowsePlace[];
  types: string[];
  areas: { id: string; name: string }[];
  extraTags: string[];
};
