"use client";

import { useState } from "react";

export function ActionTracker({
  insightId,
  initiallyActedUpon = false,
}: {
  insightId: string;
  initiallyActedUpon?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    initiallyActedUpon ? "done" : "idle",
  );

  const respond = async (actedUpon: boolean) => {
    setStatus("saving");
    try {
      const res = await fetch("/api/insights/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insight_id: insightId, acted_upon: actedUpon }),
      });
      if (!res.ok) throw new Error("request_failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return <p className="text-sm text-foreground-secondary">Thanks for letting us know!</p>;
  }

  return (
    <div className="flex items-center gap-3 px-1">
      <p className="text-sm text-foreground-secondary">Did you act on this?</p>
      <button
        type="button"
        disabled={status === "saving"}
        onClick={() => respond(true)}
        className="badge badge-primary"
      >
        Yes
      </button>
      <button
        type="button"
        disabled={status === "saving"}
        onClick={() => respond(false)}
        className="badge bg-surface-hover text-foreground-secondary"
      >
        Not yet
      </button>
      {status === "error" && <p className="text-xs text-error">Couldn&apos;t save, try again</p>}
    </div>
  );
}
