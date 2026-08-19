"use client";

import { useEffect, useState, type ComponentType } from "react";
import { MapSlotPlaceholder } from "./browse-skeleton";
import type { BrowsePayload, PlaceIndex } from "@/lib/places-types";

type CanvasProps = {
  city: BrowsePayload["city"];
  places: PlaceIndex[];
  markerIds: string[];
  selectedPlaceId: string | null;
  onSelect: (id: string) => void;
};

export function MapView({
  city,
  places,
  markerIds,
  selectedPlaceId = null,
  onSelect,
}: {
  city: BrowsePayload["city"];
  places: PlaceIndex[];
  markerIds: string[];
  selectedPlaceId?: string | null;
  onSelect: (id: string) => void;
}) {
  const [Canvas, setCanvas] = useState<ComponentType<CanvasProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("./map-canvas").then((mod) => {
      if (!cancelled) setCanvas(() => mod.MapCanvas);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Canvas) {
    return <MapSlotPlaceholder />;
  }

  return (
    <div className="h-full w-full bg-[var(--paper)]">
      <Canvas
        city={city}
        places={places}
        markerIds={markerIds}
        selectedPlaceId={selectedPlaceId}
        onSelect={onSelect}
      />
    </div>
  );
}
