import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { HistoryTable } from "@/components/HistoryTable";
import { daysAgoIST } from "@/lib/date";
import type { ProfitLogSummary } from "@/lib/types";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sinceStr = daysAgoIST(30);

  const [{ data }, { data: expenseRows }] = await Promise.all([
    supabase
      .from("profit_logs")
      .select("id, date, revenue, costs, profit")
      .eq("user_id", user!.id)
      .gte("date", sinceStr)
      .order("date", { ascending: false }),
    supabase
      .from("expense_items")
      .select("date, item_name, amount, quantity, unit")
      .eq("user_id", user!.id)
      .gte("date", sinceStr),
  ]);

  const logs = (data ?? []) as (ProfitLogSummary & { id: string })[];

  interface DayExpenseItem {
    item_name: string;
    amount: number;
    quantity: number | null;
    unit: string | null;
  }

  const itemsByDate: Record<string, DayExpenseItem[]> = {};
  for (const row of expenseRows ?? []) {
    (itemsByDate[row.date] ??= []).push(row);
  }
  const totalProfit = logs.reduce((s, l) => s + l.profit, 0);
  const best = logs.reduce<ProfitLogSummary | null>(
    (max, l) => (!max || l.profit > max.profit ? l : max),
    null,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Last 30 days</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Every entry you&apos;ve logged, and how they add up.
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="card py-10 text-center text-foreground-secondary">No entries yet.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="stat-tile">
              <p className="text-xs text-foreground-secondary">Total profit</p>
              <p
                className={`font-heading text-xl font-bold ${
                  totalProfit >= 0 ? "text-primary-600" : "text-error"
                }`}
              >
                ₹{totalProfit.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="stat-tile">
              <p className="text-xs text-foreground-secondary">Best day</p>
              <p className="font-heading text-xl font-bold">
                {best ? `₹${best.profit.toLocaleString("en-IN")}` : "—"}
              </p>
            </div>
          </div>

          <div className="card">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground-secondary">
              <TrendingUp size={15} />
              Profit trend
            </div>
            <Sparkline logs={logs} />
          </div>

          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <HistoryTable logs={logs} itemsByDate={itemsByDate} />
            </div>
            {Object.keys(itemsByDate).length > 0 && (
              <p className="border-t border-border px-4 py-2 text-xs text-foreground-muted">
                Tap a day with a chevron to see what was bought that day. Entered something wrong? Delete the day with the bin icon, then log it again.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Sparkline({ logs }: { logs: ProfitLogSummary[] }) {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const values = sorted.map((l) => l.profit);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 300;
  const height = 70;
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  const points = values.map((v, i) => [i * step, height - ((v - min) / range) * height]);
  const linePoints = points.map((p) => p.join(",")).join(" ");
  const areaPoints = `0,${height} ${linePoints} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary-500)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--primary-500)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#spark-fill)" />
      <polyline
        points={linePoints}
        fill="none"
        stroke="var(--primary-500)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
