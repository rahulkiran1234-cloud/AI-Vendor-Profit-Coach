import type { ProfitLogSummary } from "@/lib/types";

export interface TrendStats {
  avg7Day: number;
  avg30Day: number;
  trendDirection: "up" | "down" | "stable";
  changePercent: number | null;
}

const TREND_THRESHOLD_PERCENT = 5;

/**
 * Computes a vendor's own historical baseline to compare one day's profit
 * against. `history` is filtered to exclude every date on or after
 * `current.date` — not just an exact match — regardless of whether the
 * caller's query already excluded it. Two real bugs, both found via code
 * review/testing:
 *
 * 1. Filtering only `!== current.date` let *later* dates leak into the
 *    baseline for any day other than the most recent (e.g. backfilling an
 *    older day compared it against days that hadn't happened yet).
 * 2. The old `current.profit > avg7Day * 1.05` band inverts when `avg7Day`
 *    is negative — multiplying a negative average by 1.05 makes it *more*
 *    negative, so "up" meant "below average" for any vendor averaging a
 *    loss. Comparing the percentage change directly (already computed below
 *    with `Math.abs` in the denominator) is sign-safe.
 *
 * This is the one place this math happens; dashboard/page.tsx,
 * result/[logId]/page.tsx, and /api/insights/generate all call this instead
 * of recomputing it inline.
 */
export function computeTrendStats(
  history: ProfitLogSummary[],
  current: { date: string; profit: number },
): TrendStats {
  const priorLogs = history.filter((l) => l.date < current.date);
  const last7 = priorLogs.slice(0, 7);

  const avg7Day = last7.length ? last7.reduce((s, l) => s + l.profit, 0) / last7.length : 0;
  const avg30Day = priorLogs.length
    ? priorLogs.reduce((s, l) => s + l.profit, 0) / priorLogs.length
    : 0;

  const changePercent = avg7Day !== 0 ? ((current.profit - avg7Day) / Math.abs(avg7Day)) * 100 : null;

  const trendDirection: TrendStats["trendDirection"] =
    changePercent === null
      ? "stable"
      : changePercent > TREND_THRESHOLD_PERCENT
        ? "up"
        : changePercent < -TREND_THRESHOLD_PERCENT
          ? "down"
          : "stable";

  return { avg7Day, avg30Day, trendDirection, changePercent };
}
