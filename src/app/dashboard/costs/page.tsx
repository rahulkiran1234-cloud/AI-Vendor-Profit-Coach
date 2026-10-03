"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Receipt, Lightbulb, ChevronRight } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import type { CostSavingInsightResult, TopExpenseItem } from "@/lib/types";

interface CostsSummaryResponse {
  top_items: TopExpenseItem[];
  recommendation: CostSavingInsightResult | null;
}

export default function CostsPage() {
  const [data, setData] = useState<CostsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/costs/summary")
      .then(async (res) => {
        if (!res.ok) throw new Error("request_failed");
        return res.json();
      })
      .then(setData)
      .catch(() => setError("Could not load your cost breakdown."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner label="Crunching your expenses…" />;
  if (!data) return <p className="text-error">{error ?? "Something went wrong."}</p>;

  const maxAmount = Math.max(...data.top_items.map((i) => i.total_amount), 1);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Where your money goes</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Based on itemized expenses you&apos;ve logged in the last 30 days.
        </p>
      </div>

      {data.top_items.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <Receipt size={22} />
          </div>
          <div>
            <p className="font-heading font-semibold">No itemized expenses yet</p>
            <p className="mt-1 text-sm text-foreground-secondary">
              Next time you log profit, mention what you bought — e.g. &ldquo;pyaz 2 kilo, 160
              rupees&rdquo; — or add items manually on the confirm screen.
            </p>
          </div>
        </div>
      ) : (
        <>
          {data.recommendation && (
            <div className="card flex items-start gap-3 border-warning-100 bg-warning-100/40">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-100 text-warning">
                <Lightbulb size={16} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-warning">
                  Cost-saving opportunity
                </p>
                <p className="mt-0.5 font-medium leading-snug">{data.recommendation.insight_text}</p>
                <p className="mt-2 text-xs text-foreground-secondary">
                  You pay ₹{data.recommendation.vendor_unit_price}/{data.recommendation.unit} vs.
                  a ₹{data.recommendation.benchmark_unit_price}/{data.recommendation.unit} average
                  across {data.recommendation.vendor_count} nearby vendors.
                </p>
              </div>
            </div>
          )}

          <div className="card flex flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              Top expenses
            </p>
            {data.top_items.map((item, index) => (
              <Link
                key={`${item.canonical_item_key}-${index}`}
                href={`/dashboard/costs/${encodeURIComponent(item.canonical_item_key)}`}
                className="group flex flex-col gap-1.5"
              >
                <div className="flex items-baseline justify-between text-sm">
                  <span className="flex items-center gap-1 font-medium capitalize">
                    {item.item_name}
                    <ChevronRight
                      size={13}
                      className="text-foreground-muted transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                  <span className="text-foreground-secondary">
                    ₹{item.total_amount.toLocaleString("en-IN")}
                    {item.avg_unit_price && (
                      <span className="text-foreground-muted"> · ₹{item.avg_unit_price}/{item.unit}</span>
                    )}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(item.total_amount / maxAmount) * 100}%`,
                      background: "var(--gradient-brand)",
                    }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
