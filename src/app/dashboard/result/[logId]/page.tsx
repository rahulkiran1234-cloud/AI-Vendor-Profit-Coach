import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateTrendInsight } from "@/lib/anthropic/prompts";
import { computeLoanEligibility } from "@/lib/loan";
import { computeTrendStats } from "@/lib/trend";
import { daysAgoIST, shiftDate, todayIST } from "@/lib/date";
import { ProfitCard } from "@/components/ProfitCard";
import { InsightDisplay, FirstEntryPlaceholder } from "@/components/InsightDisplay";
import { LoanBadge } from "@/components/LoanBadge";
import { ActionTracker } from "@/components/ActionTracker";
import { DeleteLogButton } from "@/components/DeleteLogButton";
import type { Language } from "@/lib/database.types";
import type { ProfitLogSummary } from "@/lib/types";

// 7 earlier days to compare against (= "Day 8+" in the original spec).
const MIN_PRIOR_DAYS_FOR_INSIGHT = 7;

export default async function ResultPage({
  params,
}: {
  params: Promise<{ logId: string }>;
}) {
  const { logId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: log } = await supabase
    .from("profit_logs")
    .select("id, date, profit, user_id")
    .eq("id", logId)
    .eq("user_id", user.id)
    .single();

  if (!log) notFound();

  // 60 days back so that a day logged late (up to 30 days ago) still has a
  // full 30 days of earlier history to be compared against.
  const { data: history } = await supabase
    .from("profit_logs")
    .select("date, revenue, costs, profit")
    .eq("user_id", user.id)
    .gte("date", daysAgoIST(60))
    .order("date", { ascending: false });

  const allLogs = (history ?? []) as ProfitLogSummary[];
  // Loan eligibility is about the vendor's recent record, not about this day.
  const loanResult = computeLoanEligibility(allLogs.filter((l) => l.date >= daysAgoIST(30)));
  // The trend compares this day against only the 30 days *before it* — which,
  // for a backdated entry, is not the same as the last 30 days.
  const trendLogs = allLogs.filter((l) => l.date >= shiftDate(log.date, -30));
  const priorDays = trendLogs.filter((l) => l.date < log.date).length;

  const { data: existingInsight } = await supabase
    .from("insights")
    .select("id, insight_text, acted_upon")
    .eq("profit_log_id", logId)
    .maybeSingle();

  let insight = existingInsight;

  if (!insight && priorDays >= MIN_PRIOR_DAYS_FOR_INSIGHT) {
    const { data: profile } = await supabase
      .from("users")
      .select("language")
      .eq("id", user.id)
      .single();
    const language: Language = profile?.language ?? "hindi";

    const { avg7Day, avg30Day, trendDirection } = computeTrendStats(trendLogs, log);

    try {
      const generated = await generateTrendInsight({
        language,
        todayProfit: log.profit,
        avg7Day: Math.round(avg7Day),
        avg30Day: Math.round(avg30Day),
        trendDirection,
      });

      if (generated) {
        const { data: saved, error: insertError } = await supabase
          .from("insights")
          .insert({
            user_id: user.id,
            profit_log_id: logId,
            insight_type: generated.insight_type,
            insight_text: generated.insight_text,
            confidence_score: generated.confidence_score,
          })
          .select("id, insight_text, acted_upon")
          .single();

        if (insertError?.code === "23505") {
          // Another request (e.g. a concurrent render) already inserted one
          // for this log — use that instead of erroring or duplicating.
          const { data: race } = await supabase
            .from("insights")
            .select("id, insight_text, acted_upon")
            .eq("profit_log_id", logId)
            .single();
          insight = race ?? null;
        } else {
          insight = saved ?? null;
        }
      }
    } catch (err) {
      console.error("Insight generation failed on result page:", err);
      // Degrade gracefully — show profit without AI context.
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <p className="text-center text-sm font-medium text-foreground-secondary">Saved ✓</p>

      <ProfitCard
        profit={log.profit}
        date={formatDate(log.date)}
        label={log.date === todayIST() ? "Today's profit" : "Profit"}
      />

      {insight ? (
        <div className="flex flex-col gap-2">
          <InsightDisplay insightText={insight.insight_text} />
          <ActionTracker insightId={insight.id} initiallyActedUpon={insight.acted_upon ?? false} />
        </div>
      ) : priorDays < MIN_PRIOR_DAYS_FOR_INSIGHT ? (
        <FirstEntryPlaceholder />
      ) : null}

      <LoanBadge
        eligibilityAmount={loanResult.loan_eligibility_amount}
        consistencyPercentage={loanResult.consistency_percentage}
      />

      <Link href="/dashboard/voice-input" className="btn-secondary">
        Log another day
      </Link>

      <DeleteLogButton
        logId={log.id}
        variant="text"
        redirectTo={`/dashboard/voice-input?date=${log.date}`}
      />
    </div>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}
