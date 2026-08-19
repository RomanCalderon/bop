"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInButton() {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="rounded-full bg-[var(--ink)] px-4 py-2 text-[var(--paper)]"
        onClick={() => {
          setError(null);
          void authClient.signIn.social({ provider: "google" }).catch(() => {
            setError("Couldn’t sign in. Try again.");
          });
        }}
      >
        Continue with Google
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
