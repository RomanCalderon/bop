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
