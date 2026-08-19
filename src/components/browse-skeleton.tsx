const pulse =
  "animate-pulse motion-reduce:animate-none bg-[color-mix(in_srgb,var(--ink)_8%,var(--paper))]";

export function MapSlotPlaceholder({ busy = true }: { busy?: boolean }) {
  return (
    <div
      data-testid="map-slot"
      aria-hidden={busy ? undefined : true}
      className="h-full min-h-0 bg-[var(--paper)]"
    />
  );
}

export function PlaceListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="min-h-0 flex-1" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <div className={`h-14 w-14 shrink-0 rounded-lg ${pulse}`} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className={`h-4 w-2/3 rounded ${pulse}`} />
            <div className={`h-3 w-1/2 rounded ${pulse}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function BrowseSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading places"
      className="grid min-h-dvh grid-rows-[auto_40vh_auto_minmax(0,1fr)] bg-[var(--paper)] text-[var(--ink)] md:h-dvh md:grid-cols-[28rem_minmax(0,1fr)] md:grid-rows-[auto_auto_minmax(0,1fr)]"
    >
      <header className="flex items-center justify-between gap-2 px-4 py-3 md:col-start-1 md:row-start-1 md:border-r md:border-[color-mix(in_srgb,var(--ink)_12%,var(--paper))]">
        <div className={`h-6 w-28 rounded ${pulse}`} />
        <div className="flex items-center gap-2">
          <div className={`h-9 w-9 rounded-full ${pulse}`} />
          <div className={`h-9 w-9 rounded-full ${pulse}`} />
          <div className={`h-9 w-9 rounded-full ${pulse}`} />
        </div>
      </header>
      <div className="h-full min-h-0 md:col-start-2 md:row-span-3 md:row-start-1">
        <MapSlotPlaceholder />
      </div>
      <div className="px-4 py-3 md:col-start-1 md:row-start-2 md:border-r md:border-[color-mix(in_srgb,var(--ink)_12%,var(--paper))]">
        <div className={`h-10 w-full rounded-full ${pulse}`} />
      </div>
      <section
        aria-label="Places"
        className="flex min-h-0 flex-col md:col-start-1 md:row-start-3 md:border-r md:border-[color-mix(in_srgb,var(--ink)_12%,var(--paper))]"
      >
        <PlaceListSkeleton />
      </section>
    </div>
  );
}
