> Required prior reads: [overview.md](../overview.md), [global-constraints.md](../global-constraints.md).  
> Do not open `README.md` or other task files.

### Task 13: Add, detail, settings, and sign-in UI

**Files:**
- Create: `src/components/app-shell.tsx`
- Create: `src/components/app-shell.test.tsx`
- Create: `src/components/add-place.tsx`
- Create: `src/components/place-detail.tsx`
- Create: `src/components/toast.tsx`
- Create: `src/app/settings/page.tsx`
- Create: `src/components/settings-form.tsx`
- Create: `src/components/settings-form.test.tsx`
- Create: `src/app/sign-in/page.test.tsx`
- Create: `src/app/not-invited/page.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/browse-app.tsx` (settings link in the header overflow)

**Interfaces:**
- Consumes: `searchPlaces`, `addPlace`, `updatePlace`, `deletePlace`, `movePlace` from `src/actions/places.ts`; `inviteEmail`, `removeAllowedEmail`, `listAllowedEmails`, `renameCity`, `createArea` from `src/actions/settings.ts`; `BrowseApp` from Task 12
- Produces: Add overlay (Autocomplete); place sheet on phone / side panel on desktop; settings invite/remove/rename; toast on failed edit (field stays dirty)

- [ ] **Step 1: Write the failing tests**

`src/components/app-shell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";
import type { BrowsePayload, BrowsePlace } from "@/lib/places-types";

vi.mock("./map-view", () => ({
  MapView: ({
    onSelect,
  }: {
    onSelect: (id: string) => void;
  }) => (
    <button type="button" onClick={() => onSelect("p1")}>
      pin-p1
    </button>
  ),
}));

const place: BrowsePlace = {
  id: "p1",
  placeId: "ChIJ1",
  name: "Slant of Light Books",
  lat: 30.27,
  lng: -97.74,
  formattedAddress: "Austin",
  cityId: "c1",
  areaId: "east",
  areaName: "East",
  type: "book store",
  extraTags: [],
  notes: "Quiet",
  rating: 4.8,
  googleMapsUrl: "https://maps.google.com/?cid=1",
  photoName: "places/ChIJ1/photos/AAA",
  authorAttributions: [{ displayName: "Ada", uri: null }],
  seedFeatureCid: null,
};

const payload: BrowsePayload = {
  city: { id: "c1", name: "Austin", centerLat: 30.27, centerLng: -97.74 },
  cities: [{ id: "c1", name: "Austin", placeCount: 1 }],
  types: ["book store"],
  areas: [{ id: "east", name: "East" }],
  extraTags: [],
  places: [place],
};

describe("AppShell", () => {
  it("opens detail from a list row and from a pin", async () => {
    const user = userEvent.setup();
    render(
      <AppShell
        initial={payload}
        onCityChange={async () => payload}
        searchPlaces={async () => ({ ok: true, suggestions: [] })}
        addPlace={async () => ({ ok: true, place, created: true })}
        updatePlace={async () => ({ ok: true, place })}
        deletePlace={async () => ({ ok: true })}
        movePlace={async () => ({ ok: true, place })}
        createArea={async () => ({
          ok: true,
          area: { id: "east", name: "East" },
        })}
      />,
    );
    await user.click(screen.getByText("Slant of Light Books"));
    expect(screen.getByRole("heading", { name: "Slant of Light Books" })).toBeInTheDocument();
    expect(screen.getByText("Photo: Ada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByText("pin-p1"));
    expect(screen.getByRole("heading", { name: "Slant of Light Books" })).toBeInTheDocument();
  });

  it("adds a place from the overlay and shows the new row", async () => {
    const user = userEvent.setup();
    const added: BrowsePlace = { ...place, id: "p2", name: "New Cafe", type: "cafe" };
    render(
      <AppShell
        initial={payload}
        onCityChange={async () => payload}
        searchPlaces={async () => ({
          ok: true,
          suggestions: [
            {
              placeId: "ChIJ-new",
              primaryText: "New Cafe",
              secondaryText: "Austin, TX",
            },
          ],
        })}
        addPlace={async () => ({ ok: true, place: added, created: true })}
        updatePlace={async () => ({ ok: true, place })}
        deletePlace={async () => ({ ok: true })}
        movePlace={async () => ({ ok: true, place })}
        createArea={async () => ({
          ok: true,
          area: { id: "east", name: "East" },
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Add place" }));
    await user.type(screen.getByPlaceholderText("Search Google places"), "cafe");
    await user.click(screen.getByRole("button", { name: /New Cafe/ }));
    expect(screen.getByText("New Cafe")).toBeInTheDocument();
  });
});
```

`src/components/settings-form.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsForm } from "./settings-form";

describe("SettingsForm", () => {
  it("invites an email and does not offer remove on env emails", async () => {
    const user = userEvent.setup();
    const inviteEmail = vi.fn(async () => ({ ok: true as const }));
    render(
      <SettingsForm
        envEmails={["ada@x.com"]}
        tableEmails={["bob@x.com"]}
        cities={[{ id: "c1", name: "Austin" }]}
        inviteEmail={inviteEmail}
        removeAllowedEmail={async () => ({ ok: true })}
        renameCity={async () => ({ ok: true })}
      />,
    );
    expect(screen.queryByRole("button", { name: "Remove ada@x.com" })).toBeNull();
    expect(screen.getByRole("button", { name: "Remove bob@x.com" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Invite email"), "cai@x.com");
    await user.click(screen.getByRole("button", { name: "Invite" }));
    expect(inviteEmail).toHaveBeenCalledWith("cai@x.com");
  });
});
```

`src/app/sign-in/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { social: vi.fn() } },
}));

import SignInPage from "./page";

describe("SignInPage", () => {
  it("renders the Google sign-in action", () => {
    render(<SignInPage />);
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument();
  });
});
```

`src/app/not-invited/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotInvitedPage from "./page";

describe("NotInvitedPage", () => {
  it("shows the not-invited copy and no place names", () => {
    render(<NotInvitedPage />);
    expect(screen.getByText("Not invited")).toBeInTheDocument();
    expect(screen.queryByText("Slant of Light Books")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project jsdom src/components/app-shell.test.tsx src/components/settings-form.test.tsx src/app/sign-in/page.test.tsx src/app/not-invited/page.test.tsx`
Expected: FAIL — `AppShell` / `SettingsForm` not found.

- [ ] **Step 3: Write the UI**

`src/components/app-shell.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { AutocompleteSuggestion, BrowsePayload, BrowsePlace } from "@/lib/places-types";
import { AddPlace } from "./add-place";
import { BrowseApp } from "./browse-app";
import { PlaceDetail } from "./place-detail";
import { Toast } from "./toast";

export type AppShellActions = {
  initial: BrowsePayload;
  onCityChange: (cityId: string) => Promise<BrowsePayload>;
  searchPlaces: (
    input: string,
  ) => Promise<
    | { ok: true; suggestions: AutocompleteSuggestion[] }
    | { ok: false; message: string }
  >;
  addPlace: (
    placeId: string,
    currentCityId: string | null,
  ) => Promise<
    | { ok: true; place: BrowsePlace; created: boolean }
    | { ok: false; message: string }
  >;
  updatePlace: (
    id: string,
    patch: {
      notes?: string;
      extraTags?: string[];
      type?: string | null;
      areaId?: string | null;
      cityId?: string;
    },
  ) => Promise<{ ok: true; place: BrowsePlace } | { ok: false; message: string }>;
  deletePlace: (id: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  movePlace: (
    id: string,
    toCityId: string,
  ) => Promise<
    | { ok: true; place: BrowsePlace }
    | { ok: false; message: string; existingPlaceId?: string }
  >;
  createArea: (
    cityId: string,
    name: string,
  ) => Promise<
    | { ok: true; area: { id: string; name: string } }
    | { ok: false; message: string }
  >;
};

export function AppShell(props: AppShellActions) {
  const [payload, setPayload] = useState(props.initial);
  const [selected, setSelected] = useState<BrowsePlace | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function upsertPlace(place: BrowsePlace) {
    setPayload((prev) => {
      const exists = prev.places.some((p) => p.id === place.id);
      const places = exists
        ? prev.places.map((p) => (p.id === place.id ? place : p))
        : [...prev.places, place];
      return {
        ...prev,
        places,
        types: [...new Set([...prev.types, place.type].filter((t): t is string => Boolean(t)))],
        extraTags: [...new Set([...prev.extraTags, ...place.extraTags])],
      };
    });
  }

  return (
    <>
      <BrowseApp
        initial={payload}
        onCityChange={async (id) => {
          const next = await props.onCityChange(id);
          setPayload(next);
          return next;
        }}
        onOpenPlace={setSelected}
        onAdd={() => setAdding(true)}
      />
      {adding ? (
        <AddPlace
          currentCityId={payload.city?.id ?? null}
          searchPlaces={props.searchPlaces}
          addPlace={props.addPlace}
          onClose={() => setAdding(false)}
          onSaved={(place) => {
            upsertPlace(place);
            setAdding(false);
            setSelected(place);
          }}
        />
      ) : null}
      {selected ? (
        <PlaceDetail
          place={selected}
          cities={payload.cities}
          areas={payload.areas}
          updatePlace={props.updatePlace}
          deletePlace={props.deletePlace}
          movePlace={props.movePlace}
          createArea={props.createArea}
          onClose={() => setSelected(null)}
          onChanged={(place) => {
            upsertPlace(place);
            setSelected(place);
          }}
          onDeleted={(id) => {
            setPayload((prev) => ({
              ...prev,
              places: prev.places.filter((p) => p.id !== id),
            }));
            setSelected(null);
          }}
          onError={setToast}
        />
      ) : null}
      {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
    </>
  );
}
```

`BrowseApp` already takes a controlled `payload` prop from Task 12. `AppShell` is the only owner of that state.

`src/components/add-place.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { AutocompleteSuggestion, BrowsePlace } from "@/lib/places-types";

export function AddPlace({
  currentCityId,
  searchPlaces,
  addPlace,
  onClose,
  onSaved,
}: {
  currentCityId: string | null;
  searchPlaces: AppShellActions["searchPlaces"];
  addPlace: AppShellActions["addPlace"];
  onClose: () => void;
  onSaved: (place: BrowsePlace) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<AutocompleteSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      void searchPlaces(q).then((res) => {
        if (res.ok) setHits(res.suggestions);
        else setError(res.message);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [q, searchPlaces]);

  return (
    <div className="fixed inset-0 z-40 bg-black/40 p-4" role="dialog">
      <div className="mx-auto max-w-lg rounded-2xl bg-[var(--paper)] p-4">
        <div className="flex justify-between">
          <h2 className="text-lg font-semibold">Add place</h2>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <input
          value={q}
          onChange={(e) => {
            setError(null);
            setQ(e.target.value);
          }}
          placeholder="Search Google places"
          className="mt-3 w-full rounded-full border px-3 py-2"
        />
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        <ul className="mt-3">
          {hits.map((hit) => (
            <li key={hit.placeId}>
              <button
                type="button"
                className="w-full py-2 text-left"
                onClick={async () => {
                  const res = await addPlace(hit.placeId, currentCityId);
                  if (!res.ok) setError(res.message);
                  else onSaved(res.place);
                }}
              >
                {hit.primaryText}
                <span className="block text-sm text-stone-500">
                  {hit.secondaryText}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

Import `AppShellActions` from `./app-shell` in this file (or inline the two function types to avoid a cycle). Prefer inlining the two callback types.

`src/components/place-detail.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { BrowsePlace } from "@/lib/places-types";

export function PlaceDetail({
  place,
  cities,
  areas,
  updatePlace,
  deletePlace,
  movePlace,
  createArea,
  onClose,
  onChanged,
  onDeleted,
  onError,
}: {
  place: BrowsePlace;
  cities: { id: string; name: string }[];
  areas: { id: string; name: string }[];
  updatePlace: AppShellActions["updatePlace"];
  deletePlace: AppShellActions["deletePlace"];
  movePlace: AppShellActions["movePlace"];
  createArea: AppShellActions["createArea"];
  onClose: () => void;
  onChanged: (place: BrowsePlace) => void;
  onDeleted: (id: string) => void;
  onError: (message: string) => void;
}) {
  const [notes, setNotes] = useState(place.notes);
  const [tags, setTags] = useState(place.extraTags.join(", "));
  const [type, setType] = useState(place.type ?? "");
  const [brokenPhoto, setBrokenPhoto] = useState(false);
  const attribution = place.authorAttributions
    .map((a) => a.displayName)
    .filter(Boolean)
    .join(", ");

  return (
    <div
      role="dialog"
      className="fixed inset-x-0 bottom-0 z-40 max-h-[80vh] overflow-auto rounded-t-2xl bg-[var(--paper)] p-4 shadow-xl md:inset-y-0 md:right-0 md:left-auto md:h-full md:w-[28rem] md:rounded-none"
    >
      <button type="button" onClick={onClose}>
        Close
      </button>
      {place.photoName && !brokenPhoto ? (
        <img
          src={`/api/photos?name=${encodeURIComponent(place.photoName)}`}
          alt=""
          className="mt-3 h-40 w-full rounded-xl object-cover"
          onError={() => setBrokenPhoto(true)}
        />
      ) : (
        <div className="mt-3 h-40 rounded-xl bg-stone-300" />
      )}
      {attribution ? <p className="mt-1 text-xs">Photo: {attribution}</p> : null}
      <h2 className="mt-3 text-xl font-semibold">{place.name}</h2>
      <p className="text-sm text-stone-500">
        {[place.type, place.areaName, place.rating].filter(Boolean).join(" · ")}
      </p>
      <a href={place.googleMapsUrl} target="_blank" rel="noreferrer" className="underline">
        Open in Google Maps
      </a>
      <label className="mt-4 block text-sm">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-lg border p-2"
        />
      </label>
      <label className="mt-2 block text-sm">
        Extra tags
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="mt-1 w-full rounded-lg border p-2"
        />
      </label>
      <label className="mt-2 block text-sm">
        Type
        <input
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="mt-1 w-full rounded-lg border p-2"
        />
      </label>
      <label className="mt-2 block text-sm">
        Area
        <select
          defaultValue={place.areaId ?? ""}
          onChange={async (e) => {
            const res = await updatePlace(place.id, { areaId: e.target.value || null });
            if (res.ok) onChanged(res.place);
            else onError(res.message);
          }}
        >
          <option value="">None</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="mt-2 text-sm underline"
        onClick={async () => {
          const name = window.prompt("New area");
          if (!name) return;
          const created = await createArea(place.cityId, name);
          if (!created.ok) return onError(created.message);
          const res = await updatePlace(place.id, { areaId: created.area.id });
          if (res.ok) onChanged(res.place);
          else onError(res.message);
        }}
      >
        New area
      </button>
      <label className="mt-2 block text-sm">
        City
        <select
          defaultValue={place.cityId}
          onChange={async (e) => {
            const res = await movePlace(place.id, e.target.value);
            if (res.ok) onChanged(res.place);
            else onError(res.message);
          }}
        >
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="mt-4 rounded-full bg-[var(--ink)] px-4 py-2 text-[var(--paper)]"
        onClick={async () => {
          const res = await updatePlace(place.id, {
            notes,
            extraTags: tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            type: type || null,
          });
          if (res.ok) onChanged(res.place);
          else onError(res.message);
        }}
      >
        Save
      </button>
      <button
        type="button"
        className="mt-2 block text-sm text-red-700"
        onClick={async () => {
          const res = await deletePlace(place.id);
          if (res.ok) onDeleted(place.id);
          else onError(res.message);
        }}
      >
        Delete
      </button>
    </div>
  );
}
```

Inline the action types instead of importing `AppShellActions` if that creates a cycle.

`src/app/page.tsx` (replace Task 12’s `BrowseApp` render):

```tsx
import { redirect } from "next/navigation";
import { addPlace, deletePlace, movePlace, searchPlaces, updatePlace } from "@/actions/places";
import { changeCity, getBrowsePayload } from "@/actions/browse";
import { createArea } from "@/actions/settings";
import { AppShell } from "@/components/app-shell";
import { getAllowedSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getAllowedSession();
  if (!session.ok && session.reason === "unauthenticated") redirect("/sign-in");
  if (!session.ok && session.reason === "not_invited") redirect("/not-invited");
  const initial = await getBrowsePayload();
  return (
    <AppShell
      initial={initial}
      onCityChange={changeCity}
      searchPlaces={searchPlaces}
      addPlace={addPlace}
      updatePlace={updatePlace}
      deletePlace={deletePlace}
      movePlace={movePlace}
      createArea={createArea}
    />
  );
}
```

`src/components/toast.tsx`:

```tsx
"use client";

export function Toast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--ink)] px-4 py-2 text-sm text-[var(--paper)]">
      {message}
      <button type="button" className="ml-3 underline" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
```

`src/app/page.tsx` renders `AppShell` instead of `BrowseApp`, passing the real server actions as props (they are Server Actions and are serializable).

Header overflow: in `browse-app.tsx` add a link `<a href="/settings">Settings</a>` next to `+`.

`src/app/settings/page.tsx` (Server Component):

```tsx
import { redirect } from "next/navigation";
import { getBrowsePayload } from "@/actions/browse";
import {
  inviteEmail,
  listAllowedEmails,
  removeAllowedEmail,
  renameCity,
} from "@/actions/settings";
import { SettingsForm } from "@/components/settings-form";
import { getAllowedSession } from "@/lib/session";

export default async function SettingsPage() {
  const session = await getAllowedSession();
  if (!session.ok && session.reason === "unauthenticated") redirect("/sign-in");
  if (!session.ok && session.reason === "not_invited") redirect("/not-invited");
  const emails = await listAllowedEmails();
  const browse = await getBrowsePayload();
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <a href="/" className="text-sm underline">
        Back
      </a>
      <h1 className="mt-4 text-2xl font-semibold">Settings</h1>
      <SettingsForm
        envEmails={emails.env}
        tableEmails={emails.table}
        cities={browse.cities.map((c) => ({ id: c.id, name: c.name }))}
        inviteEmail={inviteEmail}
        removeAllowedEmail={removeAllowedEmail}
        renameCity={renameCity}
      />
    </main>
  );
}
```

`src/components/settings-form.tsx`:

```tsx
"use client";

import { useState } from "react";

export function SettingsForm({
  envEmails,
  tableEmails,
  cities,
  inviteEmail,
  removeAllowedEmail,
  renameCity,
}: {
  envEmails: string[];
  tableEmails: string[];
  cities: { id: string; name: string }[];
  inviteEmail: (email: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  removeAllowedEmail: (email: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  renameCity: (cityId: string, name: string) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const [email, setEmail] = useState("");
  const [table, setTable] = useState(tableEmails);
  const [names, setNames] = useState(
    Object.fromEntries(cities.map((c) => [c.id, c.name])),
  );

  return (
    <div className="mt-6 flex flex-col gap-6">
      <section>
        <h2 className="font-semibold">Allowed emails</h2>
        <ul className="mt-2">
          {envEmails.map((e) => (
            <li key={e}>{e}</li>
          ))}
          {table.map((e) => (
            <li key={e} className="flex items-center gap-2">
              {e}
              <button
                type="button"
                onClick={async () => {
                  const res = await removeAllowedEmail(e);
                  if (res.ok) setTable((prev) => prev.filter((x) => x !== e));
                }}
              >
                Remove {e}
              </button>
            </li>
          ))}
        </ul>
        <label className="mt-3 block text-sm">
          Invite email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border p-2"
          />
        </label>
        <button
          type="button"
          className="mt-2 rounded-full bg-[var(--ink)] px-4 py-2 text-[var(--paper)]"
          onClick={async () => {
            const res = await inviteEmail(email);
            if (res.ok) {
              setTable((prev) =>
                prev.includes(email.toLowerCase()) ? prev : [...prev, email.toLowerCase()],
              );
              setEmail("");
            }
          }}
        >
          Invite
        </button>
      </section>
      <section>
        <h2 className="font-semibold">Cities</h2>
        {cities.map((c) => (
          <label key={c.id} className="mt-2 block text-sm">
            {c.name}
            <input
              value={names[c.id] ?? c.name}
              onChange={(e) =>
                setNames((prev) => ({ ...prev, [c.id]: e.target.value }))
              }
              onBlur={() => void renameCity(c.id, names[c.id] ?? c.name)}
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>
        ))}
      </section>
    </div>
  );
}
```

No city delete control. Env emails are text only.

`AppShell` action prop types (so tests can inject fakes):

```ts
export type AppShellActions = {
  initial: BrowsePayload;
  onCityChange: (cityId: string) => Promise<BrowsePayload>;
  searchPlaces: typeof searchPlaces;
  addPlace: typeof addPlace;
  updatePlace: typeof updatePlace;
  deletePlace: typeof deletePlace;
  movePlace: typeof movePlace;
  createArea: typeof createArea;
};
```

Use those types on the real page by passing the imported server actions.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project jsdom src/components/app-shell.test.tsx src/components/settings-form.test.tsx src/app/sign-in/page.test.tsx src/app/not-invited/page.test.tsx src/components/browse-app.test.tsx`
Expected: PASS.

Run: `npm test`
Expected: PASS for the full suite.

- [ ] **Step 5: Commit**

```bash
MSGFILE=$(mktemp)
cat > "$MSGFILE" <<'EOF'
Add place search, detail, and settings screens

* Open a sheet or panel from a row or pin and add via Autocomplete
* Keep settings invite-only and show photo attribution on the place
EOF
git add src/components/app-shell.tsx src/components/app-shell.test.tsx src/components/add-place.tsx src/components/place-detail.tsx src/components/toast.tsx src/app/settings/page.tsx src/components/settings-form.tsx src/components/settings-form.test.tsx src/app/sign-in/page.test.tsx src/app/not-invited/page.test.tsx src/app/page.tsx src/components/browse-app.tsx
bash ~/.cursor/skills/commit/commit-no-trailer.sh "$MSGFILE"
rm "$MSGFILE"
```
