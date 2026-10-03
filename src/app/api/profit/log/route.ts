import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { isValidLogDate } from "@/lib/date";
import type { ExpenseUnit } from "@/lib/database.types";

const KNOWN_UNITS: ExpenseUnit[] = ["kg", "g", "l", "ml", "piece", "dozen", "packet", "other"];

interface ExpenseItemPayload {
  item_name: string;
  amount: number;
  quantity?: number | null;
  unit?: ExpenseUnit | null;
  supplier_name?: string | null;
}

/**
 * Matches the DB constraints exactly (amount >= 0, quantity > 0 when
 * present, unit is a known value) so a filtered item never reaches the
 * insert and silently fails the whole batch. Previously this only checked
 * `item_name`/`amount` type — a quantity of 0 (e.g. from a Claude
 * extraction glitch) passed here, violated the DB's `check (quantity > 0)`,
 * and because all items go in one multi-row insert, took every other valid
 * item down with it while the API still reported `success: true`.
 */
function isValidExpenseItem(item: unknown): item is ExpenseItemPayload {
  if (!item || typeof item !== "object") return false;
  const i = item as Record<string, unknown>;
  if (typeof i.item_name !== "string" || !i.item_name.trim()) return false;
  if (typeof i.amount !== "number" || !Number.isFinite(i.amount) || i.amount < 0) return false;
  if (i.quantity != null && (typeof i.quantity !== "number" || i.quantity <= 0)) return false;
  if (i.unit != null && !KNOWN_UNITS.includes(i.unit as ExpenseUnit)) return false;
  return true;
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const body = await request.json().catch(() => null);
  const { date, revenue, costs, waste_loss, voice_transcription, confidence_score, expense_items } =
    body ?? {};

  if (!isValidLogDate(date)) {
    return NextResponse.json(
      { error: "Pick a date from the last 30 days (not in the future)." },
      { status: 400 },
    );
  }
  if (typeof revenue !== "number" || !Number.isFinite(revenue) || revenue < 0) {
    return NextResponse.json({ error: "Revenue must be a non-negative number." }, { status: 400 });
  }
  if (typeof costs !== "number" || !Number.isFinite(costs) || costs < 0) {
    return NextResponse.json({ error: "Costs must be a non-negative number." }, { status: 400 });
  }

  // confidence_score comes from Claude's extraction and is never trusted
  // as-is — a malformed value (e.g. "95" meaning a percentage instead of a
  // 0-1 fraction) would otherwise overflow the numeric(3,2) column and fail
  // the whole insert with a generic 500 over a metadata field.
  const safeConfidence =
    typeof confidence_score === "number" && Number.isFinite(confidence_score)
      ? Math.min(1, Math.max(0, confidence_score))
      : null;

  const validItems: ExpenseItemPayload[] = Array.isArray(expense_items)
    ? expense_items.filter(isValidExpenseItem)
    : [];

  const { data, error } = await supabase
    .from("profit_logs")
    .insert({
      user_id: user.id,
      date,
      revenue,
      costs,
      waste_loss: typeof waste_loss === "number" && waste_loss >= 0 ? waste_loss : null,
      voice_transcription: typeof voice_transcription === "string" ? voice_transcription : null,
      notes: typeof voice_transcription === "string" ? voice_transcription : null,
      confidence_score: safeConfidence,
    })
    .select("id, profit")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        {
          error:
            "You already logged this date. To change it, delete that entry in History, then log it again.",
        },
        { status: 409 },
      );
    }
    console.error("profit_logs insert failed:", error);
    return NextResponse.json({ error: "Could not save profit entry." }, { status: 500 });
  }

  if (validItems.length > 0) {
    const { error: itemsError } = await supabase.from("expense_items").insert(
      validItems.map((item) => ({
        user_id: user.id,
        profit_log_id: data.id,
        date,
        item_name: item.item_name.trim(),
        amount: item.amount,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        supplier_name: item.supplier_name ?? null,
      })),
    );

    if (itemsError) {
      // The profit entry itself is already saved — don't fail the whole request
      // over the itemized breakdown, just log it for follow-up.
      console.error("expense_items insert failed:", itemsError);
    }
  }

  return NextResponse.json({
    success: true,
    profit_log_id: data.id,
    profit: data.profit,
    message: "Profit logged successfully",
  });
}
