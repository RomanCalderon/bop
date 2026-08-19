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

function onIdle(cb: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(cb, { timeout: 1000 });
    const cancel = globalThis.cancelIdleCallback;
    return () => {
      if (typeof cancel === "function") cancel(id);
    };
  }
  const t = window.setTimeout(cb, 1000);
  return () => window.clearTimeout(t);
}

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
    const stop = onIdle(() => {
      void import("./map-canvas").then((mod) => {
        if (!cancelled) setCanvas(() => mod.MapCanvas);
      });
    });
    return () => {
      cancelled = true;
      stop();
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
