import { anthropic, CLAUDE_MODEL, parseJsonResponse } from "@/lib/anthropic/client";
import type {
  CoachContext,
  CostSavingFinding,
  ExtractedExpenseItem,
  ExtractedProfit,
  TrendInsightResult,
} from "@/lib/types";
import type { ExpenseUnit, Language } from "@/lib/database.types";

const LANGUAGE_LABEL: Record<Language, string> = {
  hindi: "Hindi",
  marathi: "Marathi",
  english: "English",
};

const KNOWN_UNITS: ExpenseUnit[] = ["kg", "g", "l", "ml", "piece", "dozen", "packet", "other"];

/** Coerces Claude's output for a numeric field to a finite number or null —
 * never trusts the type it claims (a string like "1200" or an out-of-range
 * value has been observed from LLM JSON output in practice). */
function toFiniteNumberOrNull(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function toNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * Sanitizes one extracted expense item: drops it (returns null) rather than
 * passing through anything that doesn't match the shape the DB and the rest
 * of the app expect. Extraction is best-effort, so a malformed single item
 * is dropped silently instead of failing the whole response.
 */
function sanitizeExpenseItem(raw: unknown): ExtractedExpenseItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const item_name = toNonEmptyString(r.item_name);
  if (!item_name) return null;

  const amount = toFiniteNumberOrNull(r.amount);
  if (amount === null || amount < 0) return null;

  const quantityRaw = toFiniteNumberOrNull(r.quantity);
  const quantity = quantityRaw !== null && quantityRaw > 0 ? quantityRaw : null;

  const unit =
    typeof r.unit === "string" && KNOWN_UNITS.includes(r.unit as ExpenseUnit)
      ? (r.unit as ExpenseUnit)
      : null;

  return { item_name, amount, quantity, unit };
}

/**
 * Prompt 1 — extract revenue/costs/waste, and any itemized expenses (ingredient
 * or supplier + amount) the vendor happened to mention, from a raw voice
 * transcription. Itemized extraction is best-effort: if the vendor only gives
 * an aggregate cost, `expense_items` comes back empty and that's fine — the
 * confirm screen lets them add items manually.
 */
export async function extractProfitFromTranscription(
  transcription: string,
): Promise<ExtractedProfit> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 700,
    system: `You are an expert at extracting financial information from vendor voice inputs in Hindi/Marathi/English.
Extract revenue, costs, and waste from the vendor's statement. Also extract any
individual expense items they mention by name (e.g. an ingredient or a
supplier purchase) with an amount, and — only if stated — a quantity and unit.
Always output valid JSON only, no other text.
If you cannot determine a value, set it to null.
Confidence score: 1.0 = certain, 0.5 = moderate, 0.0 = cannot determine.

Your response must be valid JSON matching exactly this shape:
{
  "revenue": <number|null>,
  "costs": <number|null>,
  "waste_loss": <number|null>,
  "expense_items": [
    { "item_name": "<string>", "amount": <number>, "quantity": <number|null>, "unit": "kg"|"g"|"l"|"ml"|"piece"|"dozen"|"packet"|"other"|null }
  ],
  "confidence_score": <0.0 to 1.0>,
  "extracted_text": "<summary of what was extracted>",
  "notes": "<any ambiguities or clarifications>"
}

Rules for expense_items:
- Only include an item if the vendor named it specifically (e.g. "onions", "aata", "gas cylinder"). Never invent items to fill the array — return [] if none were named.
- unit must be one of the enum values above, or null if no unit was stated. Do not guess a unit that wasn't said.
- If the vendor gives a quantity like "2 kg pyaz" set quantity: 2, unit: "kg". If they just say an amount ("pyaz me 200"), set quantity and unit to null.

Examples:
Input: "Aaj mujhe 40 hazaar rupees ka business kiya, kharche 30 hazaar the, waste 500"
Output: {"revenue": 40000, "costs": 30000, "waste_loss": 500, "expense_items": [], "confidence_score": 0.95, "extracted_text": "Revenue 40000, costs 30000, waste 500", "notes": ""}

Input: "1200 revenue tha, 2 kg pyaz 80 rupee kilo me liya, aata 150 ka liya, baaki kharcha 300"
Output: {"revenue": 1200, "costs": 610, "waste_loss": null, "expense_items": [{"item_name": "pyaz", "amount": 160, "quantity": 2, "unit": "kg"}, {"item_name": "aata", "amount": 150, "quantity": null, "unit": null}], "confidence_score": 0.9, "extracted_text": "Revenue 1200; onions 2kg at 80/kg, atta 150, other costs 300", "notes": "costs = 160 + 150 + 300"}

Input: "Kuch zyada bhi kum bhi nahi"
Output: {"revenue": null, "costs": null, "waste_loss": null, "expense_items": [], "confidence_score": 0.0, "extracted_text": "", "notes": "Statement too vague"}`,
    messages: [{ role: "user", content: transcription }],
  });

  const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
  const parsed = parseJsonResponse<Record<string, unknown>>(text);

  // Every field below is re-validated rather than trusted as-is — found via
  // code review that a malformed shape (a string instead of a number, a
  // non-array expense_items, an out-of-range confidence_score) previously
  // flowed straight through to the DB insert and failed there with a
  // generic 500, instead of degrading gracefully the way the voice-input
  // page's catch block already assumes it will.
  const revenue = toFiniteNumberOrNull(parsed.revenue);
  const costs = toFiniteNumberOrNull(parsed.costs);
  const wasteRaw = toFiniteNumberOrNull(parsed.waste_loss);
  const confidenceRaw = toFiniteNumberOrNull(parsed.confidence_score);

  return {
    revenue: revenue !== null && revenue >= 0 ? revenue : null,
    costs: costs !== null && costs >= 0 ? costs : null,
    waste_loss: wasteRaw !== null && wasteRaw >= 0 ? wasteRaw : null,
    expense_items: Array.isArray(parsed.expense_items)
      ? parsed.expense_items.map(sanitizeExpenseItem).filter((i): i is ExtractedExpenseItem => i !== null)
      : [],
    confidence_score: confidenceRaw !== null ? Math.min(1, Math.max(0, confidenceRaw)) : 0,
    extracted_text: toNonEmptyString(parsed.extracted_text) ?? "",
    notes: toNonEmptyString(parsed.notes) ?? "",
  };
}

/** Prompt 2 — compare today's profit against the vendor's own history. Needs 8+ days of data. */
export async function generateTrendInsight(input: {
  language: Language;
  todayProfit: number;
  avg7Day: number;
  avg30Day: number;
  trendDirection: "up" | "down" | "stable";
}): Promise<TrendInsightResult | null> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 400,
    system: `You are a business insights expert analyzing vendor profit trends.
Generate ONE actionable insight comparing today's profit to historical average.
Output must be JSON only.
Keep insight text SHORT and in ${LANGUAGE_LABEL[input.language]}.

Your response:
{
  "insight_type": "trend",
  "insight_text": "<SHORT insight in ${LANGUAGE_LABEL[input.language]}. Example: '15% higher than your Rs 600 average'>",
  "comparison": "7-day-average" | "30-day-average",
  "percentage_change": <number>,
  "confidence_score": <0.0-1.0>
}

Rules:
- Keep text under 100 characters
- Use up/down arrows (↑ / ↓) for clarity
- Compare to whichever average (7-day or 30-day) is more representative
- Only generate if confidence > 0.7 — otherwise set confidence_score below 0.7 and insight_text to ""`,
    messages: [
      {
        role: "user",
        content: `Today's profit: ${input.todayProfit}\nLast 7 days average: ${input.avg7Day}\nLast 30 days average: ${input.avg30Day}\nTrend: ${input.trendDirection}`,
      },
    ],
  });

  const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
  const parsed = parseJsonResponse<Record<string, unknown>>(text);

  const insightText = toNonEmptyString(parsed.insight_text);
  const confidence = toFiniteNumberOrNull(parsed.confidence_score) ?? 0;
  // insight_type must be exactly "trend" to satisfy the DB's not-null enum
  // column — anything else (missing, misspelled) means no insight rather
  // than a failed insert further up the call chain.
  if (!insightText || confidence <= 0.7 || parsed.insight_type !== "trend") return null;

  return {
    insight_type: "trend",
    insight_text: insightText,
    comparison: parsed.comparison === "30-day-average" ? "30-day-average" : "7-day-average",
    percentage_change: toFiniteNumberOrNull(parsed.percentage_change) ?? 0,
    confidence_score: Math.min(1, Math.max(0, confidence)),
  };
}

/**
 * Prompt 3 — phrase an already-computed cost-saving finding in the vendor's
 * language. Deliberately NOT asked to detect the opportunity or estimate
 * savings itself — see src/lib/cost-insights.ts, which computes
 * `overpay_percentage` and `estimated_monthly_savings` from real
 * expense_items rows and the anonymized cross-vendor benchmark. Claude only
 * turns those numbers into one short, natural sentence, which keeps this
 * un-hallucinatable: every number in the output was supplied, not invented.
 */
export async function phraseCostSavingInsight(
  finding: CostSavingFinding,
  language: Language,
): Promise<string> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 200,
    system: `You turn a pre-computed cost-saving finding into one short, natural sentence for a street vendor, in ${LANGUAGE_LABEL[language]}.
Use ONLY the numbers given to you — do not add, round aggressively, or invent any figure.
Output must be valid JSON only: {"insight_text": "<string, under 110 characters>"}`,
    messages: [
      {
        role: "user",
        content: `Item: ${finding.item_name}
You pay: ₹${finding.vendor_unit_price}/${finding.unit}
Vendors nearby average: ₹${finding.benchmark_unit_price}/${finding.unit} (across ${finding.vendor_count} vendors)
You're paying ${finding.overpay_percentage}% more
Estimated monthly savings if matched to the average: ₹${finding.estimated_monthly_savings}`,
      },
    ],
  });

  const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
  const parsed = parseJsonResponse<Record<string, unknown>>(text);
  const insightText = toNonEmptyString(parsed.insight_text);
  if (!insightText) throw new Error("phraseCostSavingInsight: empty or missing insight_text");
  return insightText;
}

/**
 * Phrases an already-computed loan eligibility result in the vendor's
 * language. Same rule as the cost-saving insight above: the amount, average,
 * consistency, and risk level are all computed deterministically in
 * src/lib/loan.ts — Claude only turns them into one encouraging sentence and
 * is explicitly told never to state a different loan figure.
 */
export async function phraseLoanReasoning(input: {
  language: Language;
  dailyAverage: number;
  consistencyPercentage: number;
  trend: "up" | "down" | "stable";
  riskLevel: "low" | "medium" | "high";
  amount: number;
}): Promise<string> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 200,
    system: `You turn a pre-computed loan-eligibility result into one short, encouraging sentence for a street vendor, in ${LANGUAGE_LABEL[input.language]}.
Use ONLY the numbers given to you. Never state a loan amount other than the one given — do not round it to a different figure or suggest a different one.
Output must be valid JSON only: {"reasoning": "<string, under 140 characters>"}`,
    messages: [
      {
        role: "user",
        content: `Average daily profit: ₹${input.dailyAverage}
Consistency: ${input.consistencyPercentage}% of the last 30 days logged
Trend: ${input.trend}
Risk level: ${input.riskLevel}
Eligible loan amount: ₹${input.amount}`,
      },
    ],
  });

  const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
  const parsed = parseJsonResponse<Record<string, unknown>>(text);
  const reasoning = toNonEmptyString(parsed.reasoning);
  if (!reasoning) throw new Error("phraseLoanReasoning: empty or missing reasoning");
  return reasoning;
}

/**
 * "Ask your coach" — answers a free-form question grounded strictly in data
 * retrieved from the vendor's own account (profit history, top expenses, loan
 * eligibility — see CoachContext). This is RAG in the plain sense: the
 * retrieval step already happened by the time this is called (the caller
 * queried Supabase), and this function's whole job is to generate an answer
 * that only draws on what was retrieved. It's told explicitly to decline
 * rather than guess when the data doesn't cover the question.
 */
export async function answerCoachQuestion(
  question: string,
  context: CoachContext,
  language: Language,
): Promise<string> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 400,
    system: `You are a friendly, concise profit coach for a street vendor or micro-retailer.
Answer the vendor's question using ONLY the data provided below — never invent a number, date, or item that isn't in it.
If the data doesn't cover what's being asked, say so honestly in one short sentence rather than guessing.
If the question isn't about their own business (profit, costs, loans), politely redirect them to ask about their business instead.
Keep the answer to 2-3 short sentences, in ${LANGUAGE_LABEL[language]}.
Output must be valid JSON only: {"answer": "<string>"}

Vendor type: ${context.vendorType ?? "unknown"}

Last 30 days profit log (date, revenue, costs, profit):
${JSON.stringify(context.profitLogs)}

Top expense items (name, total spent over 30 days, times logged, avg unit price, unit):
${JSON.stringify(context.topExpenseItems)}

Loan eligibility: amount ₹${context.loan.loan_eligibility_amount}, ${context.loan.consistency_percentage}% consistency, risk ${context.loan.risk_level}`,
    messages: [{ role: "user", content: question }],
  });

  const text = message.content.find((b) => b.type === "text")?.text ?? "{}";
  const parsed = parseJsonResponse<Record<string, unknown>>(text);
  const answer = toNonEmptyString(parsed.answer);
  if (!answer) throw new Error("answerCoachQuestion: empty or missing answer");
  return answer;
}
