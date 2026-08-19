"use client";

export default function Error({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="p-6">
      <p>Couldn’t load places.</p>
      <button type="button" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
