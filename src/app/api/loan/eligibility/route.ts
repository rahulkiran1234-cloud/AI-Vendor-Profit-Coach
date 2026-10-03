import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { computeLoanEligibility } from "@/lib/loan";
import { phraseLoanReasoning } from "@/lib/anthropic/prompts";
import { daysAgoIST } from "@/lib/date";
import type { Language } from "@/lib/database.types";
import type { ProfitLogSummary } from "@/lib/types";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const { data: history, error } = await supabase
    .from("profit_logs")
    .select("date, revenue, costs, profit")
    .eq("user_id", user.id)
    .gte("date", daysAgoIST(30));

  if (error) {
    console.error("profit_logs fetch failed:", error);
    return NextResponse.json({ error: "Could not fetch profit history." }, { status: 500 });
  }

  const result = computeLoanEligibility((history ?? []) as ProfitLogSummary[]);

  // Written with the service-role client, not the vendor's own session —
  // loan eligibility and lending status must never be directly writable by
  // the role that's also the subject of that eligibility, even through RLS
  // scoped to "your own row". Found via security review: with the previous
  // user-writable policy, a vendor could PATCH their own loan_records row
  // over the Supabase REST API directly and self-approve an arbitrary
  // amount — a real fraud vector once a real lender is wired in. See migration 0008, which
  // narrows loan_records' RLS policy to SELECT-only for `authenticated`.
  const serviceClient = createServiceClient();
  const { error: upsertError } = await serviceClient.from("loan_records").upsert(
    {
      user_id: user.id,
      avg_daily_profit: result.daily_average,
      consistency_score: result.consistency_percentage,
      avg_profit_30_days: result.daily_average,
      loan_eligibility_amount: result.loan_eligibility_amount,
      loan_eligibility_confidence: result.confidence_score,
    },
    { onConflict: "user_id" },
  );
  if (upsertError) {
    console.error("loan_records upsert failed:", upsertError);
  }

  // The number and every input to it were already computed deterministically
  // above — this only asks Claude to phrase that result in the vendor's
  // language. Falls back to the plain templated reasoning if the call fails,
  // same pattern as the trend/cost-saving insights. Skipped entirely when
  // there's nothing positive to phrase — asking Claude to narrate "eligible
  // for ₹0" produces a confusing sentence for a case the template already
  // states plainly.
  let recommendation = result.reasoning;
  if (result.loan_eligibility_amount > 0) {
    try {
      const { data: profile } = await supabase
        .from("users")
        .select("language")
        .eq("id", user.id)
        .single();
      const language: Language = profile?.language ?? "hindi";

      recommendation = await phraseLoanReasoning({
        language,
        dailyAverage: result.daily_average,
        consistencyPercentage: result.consistency_percentage,
        trend: result.trend,
        riskLevel: result.risk_level,
        amount: result.loan_eligibility_amount,
      });
    } catch (err) {
      console.error("Loan reasoning phrasing failed:", err);
    }
  }

  // Whether the vendor already said they're interested. Treated as "not yet"
  // on any error so this page still loads if the column isn't there.
  const { data: interest } = await supabase
    .from("loan_records")
    .select("loan_interest_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    eligible: result.loan_eligibility_amount > 0,
    interest_noted: !!interest?.loan_interest_at,
    eligibility_amount: result.loan_eligibility_amount,
    daily_average: result.daily_average,
    consistency_score: result.consistency_percentage,
    risk_level: result.risk_level,
    recommendation,
  });
}
