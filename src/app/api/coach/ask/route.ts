import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { answerCoachQuestion } from "@/lib/anthropic/prompts";
import { computeTopExpenseItems } from "@/lib/cost-insights";
import { computeLoanEligibility } from "@/lib/loan";
import { daysAgoIST, startOfTodayISTAsUTC } from "@/lib/date";
import type { Language } from "@/lib/database.types";
import type { CoachContext, ProfitLogSummary } from "@/lib/types";

const LOOKBACK_DAYS = 30;
const MAX_QUESTIONS_PER_DAY = 30;
const MAX_QUESTION_LENGTH = 500;

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";

  if (!question) {
    return NextResponse.json({ error: "Missing question" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: "Question is too long." }, { status: 400 });
  }

  const { count: questionsToday, error: countError } = await supabase
    .from("coach_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", startOfTodayISTAsUTC().toISOString());

  // Fail CLOSED on a count-query error, same reasoning as /api/insights/generate.
  if (countError || (questionsToday ?? 0) >= MAX_QUESTIONS_PER_DAY) {
    return NextResponse.json({ error: "Daily question limit reached." }, { status: 429 });
  }

  const sinceStr = daysAgoIST(LOOKBACK_DAYS);

  const [profitLogsRes, expenseItemsRes, profileRes] = await Promise.all([
    supabase
      .from("profit_logs")
      .select("date, revenue, costs, profit")
      .eq("user_id", user.id)
      .gte("date", sinceStr)
      .order("date", { ascending: false }),
    supabase
      .from("expense_items")
      .select("item_name, canonical_item_key, amount, unit, unit_price")
      .eq("user_id", user.id)
      .gte("date", sinceStr),
    supabase.from("users").select("language, vendor_type").eq("id", user.id).single(),
  ]);

  // A silently-ignored error on any of these previously meant the coach
  // confidently told a vendor "you have no profit history" instead of
  // surfacing that their own data failed to load.
  if (profitLogsRes.error || expenseItemsRes.error || profileRes.error) {
    console.error(
      "Coach context fetch failed:",
      profitLogsRes.error,
      expenseItemsRes.error,
      profileRes.error,
    );
    return NextResponse.json(
      { error: "Could not load your data right now. Please try again." },
      { status: 500 },
    );
  }

  const logs = (profitLogsRes.data ?? []) as ProfitLogSummary[];
  const context: CoachContext = {
    vendorType: profileRes.data?.vendor_type ?? null,
    profitLogs: logs,
    topExpenseItems: computeTopExpenseItems(expenseItemsRes.data ?? []),
    loan: computeLoanEligibility(logs),
  };
  const language: Language = profileRes.data?.language ?? "hindi";

  let answer: string;
  try {
    answer = await answerCoachQuestion(question, context, language);
  } catch (err) {
    console.error("Coach answer generation failed:", err);
    return NextResponse.json(
      { error: "Your coach is temporarily unavailable. Please try again in a moment." },
      { status: 502 },
    );
  }

  const { data: saved, error: saveError } = await supabase
    .from("coach_messages")
    .insert({ user_id: user.id, question, answer })
    .select("id, created_at")
    .single();

  if (saveError) {
    console.error("coach_messages insert failed:", saveError);
  }

  return NextResponse.json({
    id: saved?.id ?? null,
    question,
    answer,
    created_at: saved?.created_at ?? new Date().toISOString(),
  });
}
