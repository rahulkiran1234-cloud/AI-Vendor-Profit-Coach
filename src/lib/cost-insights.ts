import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ExpenseUnit } from "@/lib/database.types";
import type { CostSavingFinding, TopExpenseItem } from "@/lib/types";

const OVERPAY_THRESHOLD_PERCENT = 15;
const MIN_WORTHWHILE_SAVINGS = 50;

interface ExpenseItemRow {
  item_name: string;
  canonical_item_key: string | null;
  amount: number;
  unit: ExpenseUnit | null;
  unit_price: number | null;
}

/**
 * Ranks expense_items rows by total spend over the queried window. Pure
 * grouping/math — no LLM involved.
 *
 * Groups by `canonical_item_key` (from 0003_ingredient_canonicalization.sql)
 * rather than the raw typed name, so "pyaz" and "onion" logged by the same
 * vendor merge into one ranked entry instead of splitting their spend across
 * two rows — while still displaying whichever raw name was seen first, not
 * the canonical key, since that's what the vendor actually typed.
 *
 * unit_price is only averaged within same-unit entries: if a vendor logged
 * the same item as both "2 kg" and "500 g" purchases, averaging those unit
 * prices together without accounting for the unit would silently produce a
 * meaningless number. The unit with the most data points wins for display.
 */
export function computeTopExpenseItems(rows: ExpenseItemRow[], limit = 5): TopExpenseItem[] {
  const groups = new Map<
    string,
    {
      item_name: string;
      canonical_item_key: string;
      total: number;
      count: number;
      unitPricesByUnit: Map<ExpenseUnit, number[]>;
    }
  >();

  for (const row of rows) {
    const key = row.canonical_item_key ?? row.item_name.toLowerCase().trim();
    const group = groups.get(key) ?? {
      item_name: row.item_name,
      canonical_item_key: key,
      total: 0,
      count: 0,
      unitPricesByUnit: new Map<ExpenseUnit, number[]>(),
    };
    group.total += Number(row.amount);
    group.count += 1;
    if (row.unit && row.unit_price != null) {
      const list = group.unitPricesByUnit.get(row.unit) ?? [];
      list.push(Number(row.unit_price));
      group.unitPricesByUnit.set(row.unit, list);
    }
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((g) => {
      let bestUnit: ExpenseUnit | null = null;
      let bestPrices: number[] = [];
      for (const [unit, prices] of g.unitPricesByUnit) {
        if (prices.length > bestPrices.length) {
          bestUnit = unit;
          bestPrices = prices;
        }
      }

      return {
        item_name: g.item_name,
        canonical_item_key: g.canonical_item_key,
        total_amount: Math.round(g.total * 100) / 100,
        occurrences: g.count,
        avg_unit_price: bestPrices.length
          ? Math.round((bestPrices.reduce((s, v) => s + v, 0) / bestPrices.length) * 100) / 100
          : null,
        unit: bestUnit,
      };
    })
    .sort((a, b) => b.total_amount - a.total_amount)
    .slice(0, limit);
}

/**
 * Checks the vendor's biggest expense items (in spend order) against the
 * anonymized cross-vendor benchmark, and returns the first one where the
 * vendor is paying meaningfully more than average. Every number in the
 * returned finding comes from real rows — see supabase/migrations/0002 for
 * the k-anonymity floor (>=3 contributing vendors) that keeps this safe to
 * expose. Returns null if no item has enough data or no gap clears the
 * threshold — a real "nothing to report" result, not a failure.
 */
export async function findCostSavingOpportunity(
  supabase: SupabaseClient<Database>,
  topItems: TopExpenseItem[],
): Promise<CostSavingFinding | null> {
  for (const item of topItems) {
    if (!item.unit || item.avg_unit_price == null) continue;

    const { data, error } = await supabase.rpc("get_item_price_benchmark", {
      p_item_name: item.item_name,
      p_unit: item.unit,
    });

    if (error) {
      console.error("get_item_price_benchmark failed:", error);
      continue;
    }

    const benchmark = data?.[0];
    if (!benchmark || benchmark.vendor_count < 3 || !benchmark.avg_unit_price) continue;

    const overpayPercentage =
      ((item.avg_unit_price - benchmark.avg_unit_price) / benchmark.avg_unit_price) * 100;
    if (overpayPercentage < OVERPAY_THRESHOLD_PERCENT) continue;

    const estimatedMonthlySavings = Math.round(
      ((item.avg_unit_price - benchmark.avg_unit_price) / item.avg_unit_price) * item.total_amount,
    );
    if (estimatedMonthlySavings < MIN_WORTHWHILE_SAVINGS) continue;

    return {
      recommendation_type: "cost_optimization",
      item_name: item.item_name,
      vendor_unit_price: item.avg_unit_price,
      benchmark_unit_price: Math.round(benchmark.avg_unit_price * 100) / 100,
      unit: item.unit,
      vendor_count: Number(benchmark.vendor_count),
      overpay_percentage: Math.round(overpayPercentage),
      estimated_monthly_savings: estimatedMonthlySavings,
    };
  }

  return null;
}
