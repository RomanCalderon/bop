"use client";

/// <reference types="google.maps" />

import { Component, useState, type ReactNode } from "react";
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  Map,
  useApiLoadingStatus,
} from "@vis.gl/react-google-maps";
import { bopMapStyle } from "@/lib/map-style";
import type { BrowsePayload, BrowsePlace } from "@/lib/places-types";

class MapErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function mapCenter(city: BrowsePayload["city"]) {
  if (city?.centerLat != null && city.centerLng != null) {
    return { lat: city.centerLat, lng: city.centerLng };
  }
  return { lat: 39.8, lng: -98.6 };
}

function MapCanvas({
  city,
  places,
  markerIds,
  onSelect,
}: {
  city: BrowsePayload["city"];
  places: BrowsePlace[];
  markerIds: string[];
  onSelect: (id: string) => void;
}) {
  const status = useApiLoadingStatus();
  const googleMissing =
    typeof window !== "undefined" &&
    status !== APILoadingStatus.NOT_LOADED &&
    status !== APILoadingStatus.LOADING &&
    !window.google;

  if (
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE ||
    googleMissing
  ) {
    return null;
  }

  if (status !== APILoadingStatus.LOADED) {
    return null;
  }

  const visible = places.filter((place) => markerIds.includes(place.id));
  const center = mapCenter(city);

  return (
    <Map
      key={city?.id ?? "none"}
      defaultCenter={center}
      defaultZoom={city ? 12 : 4}
      styles={bopMapStyle}
      gestureHandling="greedy"
      disableDefaultUI
      className="h-full w-full"
    >
      {visible.map((place) => (
        <AdvancedMarker
          key={place.id}
          position={{ lat: place.lat, lng: place.lng }}
          onClick={() => onSelect(place.id)}
        />
      ))}
    </Map>
  );
}

export function MapView({
  city,
  places,
  markerIds,
  onSelect,
}: {
  city: BrowsePayload["city"];
  places: BrowsePlace[];
  markerIds: string[];
  onSelect: (id: string) => void;
}) {
  const [loadFailed, setLoadFailed] = useState(false);

  if (loadFailed) return null;

  return (
    <MapErrorBoundary>
      <APIProvider
        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""}
        libraries={["marker"]}
        onError={() => setLoadFailed(true)}
      >
        <MapCanvas
          city={city}
          places={places}
          markerIds={markerIds}
          onSelect={onSelect}
        />
      </APIProvider>
    </MapErrorBoundary>
  );
}
