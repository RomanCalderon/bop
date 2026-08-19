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
