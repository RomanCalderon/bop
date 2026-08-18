"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { normalizeEmail } from "@/lib/allowlist";

const ring =
  "transition-[color,box-shadow,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]";

type SettingsTab = "cities" | "invite" | "account";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "cities", label: "Cities" },
  { id: "invite", label: "Invite" },
  { id: "account", label: "Account" },
];

export function SettingsForm({
  envEmails,
  tableEmails,
  cities,
  userEmail,
  inviteEmail,
  removeAllowedEmail,
  renameCity,
}: {
  envEmails: string[];
  tableEmails: string[];
  cities: { id: string; name: string }[];
  userEmail: string;
  inviteEmail: (email: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  removeAllowedEmail: (email: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  renameCity: (cityId: string, name: string) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const baseId = useId();
  const router = useRouter();
  const [tab, setTab] = useState<SettingsTab>("cities");
  const [email, setEmail] = useState("");
  const [table, setTable] = useState(tableEmails);
  const [names, setNames] = useState(
    Object.fromEntries(cities.map((c) => [c.id, c.name])),
  );
  const [error, setError] = useState<string | null>(null);

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = TABS.findIndex((item) => item.id === tab);
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next = TABS[(index + delta + TABS.length) % TABS.length];
      setTab(next.id);
      document.getElementById(`${baseId}-tab-${next.id}`)?.focus();
    }
  }

  return (
    <div className="mt-6">
      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex gap-1 border-b border-stone-300"
      >
        {TABS.map((item) => {
          const selected = item.id === tab;
          return (
            <button
              key={item.id}
              id={`${baseId}-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={onTabKeyDown}
              className={`${ring} -mb-px border-b-2 px-3 py-2 text-sm ${
                selected
                  ? "border-[var(--ink)] font-semibold"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {(() => {
        switch (tab) {
          case "cities":
            return (
              <section
                id={`${baseId}-panel-cities`}
                role="tabpanel"
                aria-labelledby={`${baseId}-tab-cities`}
                className="mt-4"
              >
                <h2 className="font-semibold">Cities</h2>
                {cities.map((c) => (
                  <label key={c.id} className="mt-2 block text-sm">
                    {c.name}
                    <input
                      value={names[c.id] ?? c.name}
                      onChange={(e) =>
                        setNames((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      onBlur={async () => {
                        const res = await renameCity(c.id, names[c.id] ?? c.name);
                        if (!res.ok) setError(res.message);
                        else setError(null);
                      }}
                      className={`${ring} mt-1 w-full rounded-lg border border-stone-300 bg-[var(--sheet)] p-2`}
                    />
                  </label>
                ))}
              </section>
            );
          case "invite":
            return (
              <section
                id={`${baseId}-panel-invite`}
                role="tabpanel"
                aria-labelledby={`${baseId}-tab-invite`}
                className="mt-4"
              >
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
                          if (res.ok) {
                            setError(null);
                            setTable((prev) => prev.filter((x) => x !== e));
                          } else {
                            setError(res.message);
                          }
                        }}
                        className={`${ring} text-sm underline-offset-2 hover:underline`}
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
                    className={`${ring} mt-1 w-full rounded-lg border border-stone-300 bg-[var(--sheet)] p-2`}
                  />
                </label>
                <button
                  type="button"
                  className={`${ring} mt-2 rounded-full bg-[var(--ink)] px-4 py-2 text-[var(--paper)] hover:opacity-90 active:scale-[0.98]`}
                  onClick={async () => {
                    const res = await inviteEmail(email);
                    if (!res.ok) {
                      setError(res.message);
                      return;
                    }
                    setError(null);
                    const normalized = normalizeEmail(email);
                    const envSet = new Set(envEmails.map((e) => normalizeEmail(e)));
                    if (!envSet.has(normalized)) {
                      setTable((prev) =>
                        prev.includes(normalized) ? prev : [...prev, normalized],
                      );
                    }
                    setEmail("");
                  }}
                >
                  Invite
                </button>
              </section>
            );
          case "account":
            return (
              <section
                id={`${baseId}-panel-account`}
                role="tabpanel"
                aria-labelledby={`${baseId}-tab-account`}
                className="mt-4"
              >
                <h2 className="font-semibold">Account</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Signed in as <span className="text-[var(--ink)]">{userEmail}</span>
                </p>
                <button
                  type="button"
                  className={`${ring} mt-4 rounded-full border border-stone-400 px-4 py-2 text-sm hover:border-[var(--ink)] active:scale-[0.98]`}
                  onClick={async () => {
                    await authClient.signOut();
                    router.replace("/sign-in");
                    router.refresh();
                  }}
                >
                  Log out
                </button>
              </section>
            );
          default: {
            const _never: never = tab;
            return _never;
          }
        }
      })()}
    </div>
  );
}
