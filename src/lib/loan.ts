import type { LoanEligibilityResult, ProfitLogSummary } from "@/lib/types";

const MIN_LOAN = 10_000;
const MAX_LOAN = 500_000;
const WINDOW_DAYS = 30;

/**
 * Loan eligibility formula, computed deterministically rather than trusting an
 * LLM with arithmetic on money: base = 5x avg daily profit, -10% if consistency
 * < 80%, +/-10% for trend, clamped to [MIN_LOAN, MAX_LOAN].
 */
export function computeLoanEligibility(logs: ProfitLogSummary[]): LoanEligibilityResult {
  if (logs.length === 0) {
    return {
      loan_eligibility_amount: 0,
      daily_average: 0,
      consistency_percentage: 0,
      risk_level: "high",
      trend: "stable",
      reasoning: "No profit history yet — log a few days to unlock loan eligibility.",
      confidence_score: 0,
    };
  }

  const daysLogged = logs.length;
  const consistencyPercentage = Math.min(100, (daysLogged / WINDOW_DAYS) * 100);
  const avgDaily = logs.reduce((sum, l) => sum + l.profit, 0) / daysLogged;

  const trend = computeTrend(logs);

  // A vendor averaging zero or negative profit is not "eligible for at least
  // ₹10,000" — the MIN_LOAN floor below exists to round up a small-but-real
  // positive eligibility, not to manufacture one for someone losing money.
  // Found via review: a single day at a loss previously still showed
  // "eligible for ₹10,000" and could even be rated low risk.
  let amount = 0;
  if (avgDaily > 0) {
    amount = avgDaily * 5;
    if (consistencyPercentage < 80) amount *= 0.9;
    if (trend === "up") amount *= 1.1;
    if (trend === "down") amount *= 0.9;
    amount = Math.min(MAX_LOAN, Math.max(MIN_LOAN, Math.round(amount)));
  }

  const riskLevel: LoanEligibilityResult["risk_level"] =
    avgDaily <= 0
      ? "high"
      : consistencyPercentage >= 80 && trend !== "down"
        ? "low"
        : consistencyPercentage >= 50
          ? "medium"
          : "high";

  const confidence = Math.min(1, 0.4 + (daysLogged / WINDOW_DAYS) * 0.6);

  return {
    loan_eligibility_amount: amount,
    daily_average: Math.round(avgDaily * 100) / 100,
    consistency_percentage: Math.round(consistencyPercentage),
    risk_level: riskLevel,
    trend,
    reasoning: buildReasoning(avgDaily, consistencyPercentage, trend, amount),
    confidence_score: Math.round(confidence * 100) / 100,
  };
}

function computeTrend(logs: ProfitLogSummary[]): "up" | "down" | "stable" {
  if (logs.length < 4) return "stable";
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);
  const avg = (arr: ProfitLogSummary[]) => arr.reduce((s, l) => s + l.profit, 0) / arr.length;
  const change = (avg(secondHalf) - avg(firstHalf)) / (Math.abs(avg(firstHalf)) || 1);
  if (change > 0.1) return "up";
  if (change < -0.1) return "down";
  return "stable";
}

function buildReasoning(
  avgDaily: number,
  consistency: number,
  trend: "up" | "down" | "stable",
  amount: number,
): string {
  const parts = [
    `Average daily profit of Rs ${Math.round(avgDaily)}`,
    `${Math.round(consistency)}% of the last ${WINDOW_DAYS} days logged`,
    `profit trend is ${trend}`,
  ];
  if (amount <= 0) {
    return `${parts.join(", ")} → not yet eligible for a loan. A positive average daily profit unlocks this.`;
  }
  return `${parts.join(", ")} → eligible for Rs ${amount.toLocaleString("en-IN")}.`;
}
