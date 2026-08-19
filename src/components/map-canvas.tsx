"use client";

/// <reference types="google.maps" />

import { Component, useState, type ReactNode } from "react";
import {
  APILoadingStatus,
  APIProvider,
  Map,
  Marker,
  useApiLoadingStatus,
} from "@vis.gl/react-google-maps";
import { bopMapStyle } from "@/lib/map-style";
import { pinAppearance, pinIconUrl } from "@/lib/map-pins";
import type { BrowsePayload, BrowsePlace } from "@/lib/places-types";
import { MapSlotPlaceholder } from "./browse-skeleton";

class MapErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return <MapSlotPlaceholder />;
    return this.props.children;
  }
}

function mapCenter(city: BrowsePayload["city"]) {
  if (city?.centerLat != null && city.centerLng != null) {
    return { lat: city.centerLat, lng: city.centerLng };
  }
  return { lat: 39.8, lng: -98.6 };
}

function MapCanvasInner({
  city,
  places,
  markerIds,
  selectedPlaceId,
  onSelect,
}: {
  city: BrowsePayload["city"];
  places: BrowsePlace[];
  markerIds: string[];
  selectedPlaceId: string | null;
  onSelect: (id: string) => void;
}) {
  const status = useApiLoadingStatus();
  const defaultZoom = city ? 12 : 4;
  const [zoom, setZoom] = useState(defaultZoom);
  const googleMissing =
    typeof window !== "undefined" &&
    status !== APILoadingStatus.NOT_LOADED &&
    status !== APILoadingStatus.LOADING &&
    !window.google;

  const failed =
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE ||
    googleMissing;

  if (failed || status !== APILoadingStatus.LOADED) {
    return null;
  }

  const visible = places.filter((place) => markerIds.includes(place.id));
  const center = mapCenter(city);

  return (
    <Map
      key={city?.id ?? "none"}
      defaultCenter={center}
      defaultZoom={defaultZoom}
      styles={bopMapStyle}
      gestureHandling="greedy"
      disableDefaultUI
      className="h-full w-full"
      onZoomChanged={(event) => setZoom(event.detail.zoom)}
    >
      {visible.map((place) => {
        const selected = place.id === selectedPlaceId;
        const appearance = pinAppearance(zoom, selected);
        return (
          <Marker
            key={`${place.id}-${appearance.canvas}-${selected ? "on" : "off"}`}
            position={{ lat: place.lat, lng: place.lng }}
            title={place.name}
            zIndex={selected ? 2 : 1}
            icon={{
              url: pinIconUrl(appearance),
              scaledSize: new google.maps.Size(appearance.canvas, appearance.canvas),
              anchor: new google.maps.Point(
                appearance.canvas / 2,
                appearance.canvas / 2,
              ),
            }}
            onClick={() => onSelect(place.id)}
          />
        );
      })}
    </Map>
  );
}

export function MapCanvas({
  city,
  places,
  markerIds,
  selectedPlaceId,
  onSelect,
}: {
  city: BrowsePayload["city"];
  places: BrowsePlace[];
  markerIds: string[];
  selectedPlaceId: string | null;
  onSelect: (id: string) => void;
}) {
  const [loadFailed, setLoadFailed] = useState(false);

  if (loadFailed) return <MapSlotPlaceholder />;

  return (
    <MapErrorBoundary>
      <div className="h-full w-full">
        <APIProvider
          apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""}
          onError={() => setLoadFailed(true)}
        >
          <MapCanvasInner
            key={city?.id ?? "none"}
            city={city}
            places={places}
            markerIds={markerIds}
            selectedPlaceId={selectedPlaceId}
            onSelect={onSelect}
          />
        </APIProvider>
      </div>
    </MapErrorBoundary>
  );
}
