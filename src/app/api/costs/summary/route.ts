import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { computeTopExpenseItems, findCostSavingOpportunity } from "@/lib/cost-insights";
import { phraseCostSavingInsight } from "@/lib/anthropic/prompts";
import { daysAgoIST } from "@/lib/date";
import type { Language } from "@/lib/database.types";

const LOOKBACK_DAYS = 30;

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const { data: items, error } = await supabase
    .from("expense_items")
    .select("item_name, canonical_item_key, amount, unit, unit_price")
    .eq("user_id", user.id)
    .gte("date", daysAgoIST(LOOKBACK_DAYS));

  if (error) {
    console.error("expense_items fetch failed:", error);
    return NextResponse.json({ error: "Could not load expense history." }, { status: 500 });
  }

  const topItems = computeTopExpenseItems(items ?? []);

  if (topItems.length === 0) {
    return NextResponse.json({ top_items: [], recommendation: null });
  }

  let recommendation = null;
  try {
    const finding = await findCostSavingOpportunity(supabase, topItems);
    if (finding) {
      const { data: profile } = await supabase
        .from("users")
        .select("language")
        .eq("id", user.id)
        .single();
      const language: Language = profile?.language ?? "hindi";

      const insight_text = await phraseCostSavingInsight(finding, language);
      recommendation = { ...finding, insight_text };
    }
  } catch (err) {
    console.error("Cost-saving insight generation failed:", err);
    // Degrade gracefully — top items still render without the recommendation.
  }

  return NextResponse.json({ top_items: topItems, recommendation });
}
