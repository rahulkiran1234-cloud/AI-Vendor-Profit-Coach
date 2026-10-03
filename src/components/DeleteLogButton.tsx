"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

/**
 * Two-step delete for one day's entry — a single tap never destroys data,
 * since the vendor is likely tapping on a small row on a phone. Deleting
 * also removes that day's itemized expenses and insight (cascade), and
 * frees the date so it can be logged again.
 *
 * `variant="icon"` is the compact table-row form; `variant="text"` is the
 * labelled form for the result screen, where `redirectTo` sends the vendor
 * straight to re-entering the day they just deleted.
 */
export function DeleteLogButton({
  logId,
  variant = "icon",
  redirectTo,
}: {
  logId: string;
  variant?: "icon" | "text";
  redirectTo?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "confirming" | "deleting" | "error">("idle");

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setStatus("deleting");
    try {
      const res = await fetch(`/api/profit/log/${logId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error("request_failed");
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch {
      setStatus("error");
    }
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (status === "confirming" || status === "deleting" || status === "error") {
    return (
      <span className="flex items-center gap-2 text-xs" onClick={stop}>
        {status === "error" ? (
          <span className="text-error">Couldn&apos;t delete</span>
        ) : (
          <span className="text-foreground-secondary">Delete this day?</span>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={status === "deleting"}
          className="rounded-md bg-error-100 px-2 py-1 font-medium text-error disabled:opacity-50"
        >
          {status === "deleting" ? "Deleting…" : status === "error" ? "Retry" : "Delete"}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setStatus("idle");
          }}
          disabled={status === "deleting"}
          className="rounded-md px-2 py-1 font-medium text-foreground-secondary hover:bg-surface-hover"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setStatus("confirming");
      }}
      aria-label="Delete this entry"
      className={
        variant === "icon"
          ? "rounded-lg p-1.5 text-foreground-muted transition-colors hover:bg-error-100 hover:text-error"
          : "flex items-center justify-center gap-1.5 text-sm text-foreground-secondary transition-colors hover:text-error"
      }
    >
      <Trash2 size={variant === "icon" ? 15 : 14} />
      {variant === "text" && "Wrong details? Delete this entry"}
    </button>
  );
}
