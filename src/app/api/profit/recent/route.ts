import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import type { ProfitLogSummary } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const { searchParams } = new URL(request.url);
  const days = Math.min(90, Math.max(1, Number(searchParams.get("days")) || 7));

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("profit_logs")
    .select("date, revenue, costs, profit")
    .eq("user_id", user.id)
    .gte("date", since.toISOString().slice(0, 10))
    .order("date", { ascending: false });

  if (error) {
    console.error("profit_logs fetch failed:", error);
    return NextResponse.json({ error: "Could not fetch profit history." }, { status: 500 });
  }

  const logs = (data ?? []) as ProfitLogSummary[];
  const periodAverage = logs.length
    ? logs.reduce((sum, l) => sum + l.profit, 0) / logs.length
    : 0;

  const trend = computeSimpleTrend(logs);

  return NextResponse.json({
    logs,
    period_average: Math.round(periodAverage * 100) / 100,
    trend,
  });
}

function computeSimpleTrend(logs: ProfitLogSummary[]): "up" | "down" | "stable" {
  if (logs.length < 4) return "stable";
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const mid = Math.floor(sorted.length / 2);
  const avg = (arr: ProfitLogSummary[]) => arr.reduce((s, l) => s + l.profit, 0) / arr.length;
  const change =
    (avg(sorted.slice(mid)) - avg(sorted.slice(0, mid))) / (Math.abs(avg(sorted.slice(0, mid))) || 1);
  if (change > 0.1) return "up";
  if (change < -0.1) return "down";
  return "stable";
}
