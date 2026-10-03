import type { ExpenseUnit, InsightType, Language, RecommendationType } from "@/lib/database.types";

export interface ExtractedExpenseItem {
  item_name: string;
  amount: number;
  quantity: number | null;
  unit: ExpenseUnit | null;
}

export interface ExtractedProfit {
  revenue: number | null;
  costs: number | null;
  waste_loss: number | null;
  expense_items: ExtractedExpenseItem[];
  confidence_score: number;
  extracted_text: string;
  notes: string;
}

export interface TrendInsightResult {
  insight_type: Extract<InsightType, "trend">;
  insight_text: string;
  comparison: "7-day-average" | "30-day-average";
  percentage_change: number;
  confidence_score: number;
}

/** A cost-saving opportunity computed deterministically from real expense_items
 * data (never invented by an LLM) — see src/lib/cost-insights.ts. Claude's only
 * role for this is phrasing it in the vendor's language (phraseCostSavingInsight). */
export interface CostSavingFinding {
  recommendation_type: Extract<RecommendationType, "cost_optimization">;
  item_name: string;
  vendor_unit_price: number;
  benchmark_unit_price: number;
  unit: ExpenseUnit;
  vendor_count: number;
  overpay_percentage: number;
  estimated_monthly_savings: number;
}

export interface CostSavingInsightResult extends CostSavingFinding {
  insight_text: string;
}

export interface TopExpenseItem {
  item_name: string;
  canonical_item_key: string;
  total_amount: number;
  occurrences: number;
  avg_unit_price: number | null;
  unit: ExpenseUnit | null;
}

export interface ItemPurchase {
  date: string;
  amount: number;
  quantity: number | null;
  unit: ExpenseUnit | null;
  unit_price: number | null;
  supplier_name: string | null;
}

/** Everything retrieved from the database for one "ask your coach" turn —
 * the only data Claude is allowed to reason over (see answerCoachQuestion). */
export interface CoachContext {
  vendorType: string | null;
  profitLogs: ProfitLogSummary[];
  topExpenseItems: TopExpenseItem[];
  loan: LoanEligibilityResult;
}

export interface LoanEligibilityResult {
  loan_eligibility_amount: number;
  daily_average: number;
  consistency_percentage: number;
  risk_level: "low" | "medium" | "high";
  trend: "up" | "down" | "stable";
  reasoning: string;
  confidence_score: number;
}

export interface ProfitLogSummary {
  date: string;
  revenue: number;
  costs: number;
  profit: number;
}

export interface OnboardingProfile {
  full_name: string;
  language: Language;
  vendor_type: "street_food" | "retail" | "multi_location" | "other";
}
