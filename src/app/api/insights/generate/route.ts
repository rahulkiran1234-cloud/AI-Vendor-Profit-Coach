import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { generateTrendInsight } from "@/lib/anthropic/prompts";
import { computeTrendStats } from "@/lib/trend";
import { daysAgoIST, shiftDate, startOfTodayISTAsUTC } from "@/lib/date";
import type { ProfitLogSummary } from "@/lib/types";
import type { Language } from "@/lib/database.types";

// 7 earlier days to compare against (= "Day 8+" in the original spec).
const MIN_PRIOR_DAYS_FOR_INSIGHT = 7;
const MAX_INSIGHTS_PER_DAY = 100;

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const body = await request.json().catch(() => null);
  const profitLogId = body?.profit_log_id;

  if (typeof profitLogId !== "string") {
    return NextResponse.json({ error: "Missing profit_log_id" }, { status: 400 });
  }

  const { data: currentLog, error: logError } = await supabase
    .from("profit_logs")
    .select("id, date, profit, user_id")
    .eq("id", profitLogId)
    .eq("user_id", user.id)
    .single();

  if (logError || !currentLog) {
    return NextResponse.json({ error: "Profit log not found." }, { status: 404 });
  }

  // Check for an existing insight before burning a rate-limit slot or a
  // Claude call — a client retry or a page refresh previously re-generated
  // (and re-paid for) an insight every time, and because that insert never
  // happened for a found-existing case, the daily cap never actually
  // engaged. The result page already does this check; this route should
  // match it exactly.
  const { data: existing } = await supabase
    .from("insights")
    .select("id, insight_text, insight_type")
    .eq("profit_log_id", profitLogId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      insight_id: existing.id,
      insight_type: existing.insight_type,
      insight_text: existing.insight_text,
      recommendation: null,
      viewed_at: null,
    });
  }

  const { count: insightsToday, error: countError } = await supabase
    .from("insights")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", startOfTodayISTAsUTC().toISOString());

  // Fail CLOSED: if the count query itself errors, treat it as the limit
  // being reached rather than as zero — a transient Supabase error
  // previously bypassed the cap entirely instead of blocking the request.
  if (countError || (insightsToday ?? 0) >= MAX_INSIGHTS_PER_DAY) {
    return NextResponse.json({ error: "Daily insight limit reached." }, { status: 429 });
  }

  const { data: history } = await supabase
    .from("profit_logs")
    .select("date, revenue, costs, profit")
    .eq("user_id", user.id)
    // 60 days so a backdated log (up to 30 days old) still has 30 earlier days.
    .gte("date", daysAgoIST(60))
    .order("date", { ascending: false });

  // Compare against only the 30 days *before* this log — for a backdated entry
  // that is not the same as the last 30 days.
  const logs = ((history ?? []) as ProfitLogSummary[]).filter(
    (l) => l.date >= shiftDate(currentLog.date, -30),
  );
  const priorDays = logs.filter((l) => l.date < currentLog.date).length;

  if (priorDays < MIN_PRIOR_DAYS_FOR_INSIGHT) {
    return NextResponse.json({
      insight_id: null,
      insight_type: null,
      insight_text: null,
      recommendation: null,
      viewed_at: null,
      days_logged: priorDays,
      days_until_insights: MIN_PRIOR_DAYS_FOR_INSIGHT - priorDays,
    });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("language")
    .eq("id", user.id)
    .single();
  const language: Language = profile?.language ?? "hindi";

  const { avg7Day, avg30Day, trendDirection } = computeTrendStats(logs, currentLog);

  let insight;
  try {
    insight = await generateTrendInsight({
      language,
      todayProfit: currentLog.profit,
      avg7Day: Math.round(avg7Day),
      avg30Day: Math.round(avg30Day),
      trendDirection,
    });
  } catch (err) {
    console.error("Claude insight generation failed:", err);
    // Fall back to showing the profit without AI context (PART 11 decision tree).
    return NextResponse.json({
      insight_id: null,
      insight_type: null,
      insight_text: null,
      recommendation: null,
      viewed_at: null,
      ai_unavailable: true,
    });
  }

  if (!insight) {
    return NextResponse.json({
      insight_id: null,
      insight_type: null,
      insight_text: null,
      recommendation: null,
      viewed_at: null,
    });
  }

  const { data: saved, error: saveError } = await supabase
    .from("insights")
    .insert({
      user_id: user.id,
      profit_log_id: profitLogId,
      insight_type: insight.insight_type,
      insight_text: insight.insight_text,
      confidence_score: insight.confidence_score,
    })
    .select("id, insight_text, insight_type")
    .single();

  if (saveError?.code === "23505") {
    // Another request already generated one for this log — return that
    // instead of erroring or creating a duplicate.
    const { data: race } = await supabase
      .from("insights")
      .select("id, insight_text, insight_type")
      .eq("profit_log_id", profitLogId)
      .single();

    if (!race) {
      return NextResponse.json({ error: "Could not save insight." }, { status: 500 });
    }

    return NextResponse.json({
      insight_id: race.id,
      insight_type: race.insight_type,
      insight_text: race.insight_text,
      recommendation: null,
      viewed_at: null,
    });
  }

  if (saveError || !saved) {
    console.error("insights insert failed:", saveError);
    return NextResponse.json({ error: "Could not save insight." }, { status: 500 });
  }

  return NextResponse.json({
    insight_id: saved.id,
    insight_type: insight.insight_type,
    insight_text: insight.insight_text,
    recommendation: null,
    viewed_at: null,
  });
}
