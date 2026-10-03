"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Quote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VoiceInput } from "@/components/VoiceInput";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ExpenseItemsEditor } from "@/components/ExpenseItemsEditor";
import { BACKDATE_WINDOW_DAYS, daysAgoIST, todayIST } from "@/lib/date";
import type { ExtractedExpenseItem, ExtractedProfit } from "@/lib/types";
import type { Language } from "@/lib/database.types";

type Step = "record" | "extracting" | "confirm" | "saving";

export function VoiceLogFlow({ initialDate }: { initialDate: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [language, setLanguage] = useState<Language>("hindi");
  const [step, setStep] = useState<Step>("record");
  const [transcript, setTranscript] = useState("");
  const [extracted, setExtracted] = useState<ExtractedProfit | null>(null);
  const [revenue, setRevenue] = useState("");
  const [costs, setCosts] = useState("");
  const [wasteLoss, setWasteLoss] = useState("");
  const [expenseItems, setExpenseItems] = useState<ExtractedExpenseItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [logDate, setLogDate] = useState(initialDate);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("users")
        .select("language")
        .eq("id", data.user.id)
        .single();
      if (profile?.language) setLanguage(profile.language);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTranscript = async (text: string) => {
    setTranscript(text);
    setStep("extracting");
    setError(null);

    try {
      const res = await fetch("/api/voice/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcription: text }),
      });

      if (!res.ok) throw new Error("extract_failed");
      const data: ExtractedProfit = await res.json();

      setExtracted(data);
      setRevenue(data.revenue != null ? String(data.revenue) : "");
      setCosts(data.costs != null ? String(data.costs) : "");
      setWasteLoss(data.waste_loss != null ? String(data.waste_loss) : "");
      setExpenseItems(data.expense_items ?? []);
      setStep("confirm");
    } catch {
      // Fallback per PART 11: let the vendor enter numbers manually. Also
      // clear any numbers/items from a *previous* successful extraction —
      // otherwise a failed re-attempt after "Start over" silently keeps the
      // old transcript's values prefilled under a "please check" notice.
      setExtracted(null);
      setRevenue("");
      setCosts("");
      setWasteLoss("");
      setExpenseItems([]);
      setStep("confirm");
      setError("Could not understand the numbers automatically — please check them below.");
    }
  };

  const handleSave = async () => {
    const revenueNum = Number(revenue);
    const costsNum = Number(costs);

    if (!revenue || !costs || Number.isNaN(revenueNum) || Number.isNaN(costsNum)) {
      setError("Please enter both revenue and costs.");
      return;
    }
    if (revenueNum < 0 || costsNum < 0) {
      setError("Revenue and costs can't be negative.");
      return;
    }

    setStep("saving");
    setError(null);

    const validItems = expenseItems.filter(
      (item) =>
        item.item_name.trim() &&
        item.amount > 0 &&
        (item.quantity == null || item.quantity > 0),
    );

    try {
      const logRes = await fetch("/api/profit/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: logDate,
          revenue: revenueNum,
          costs: costsNum,
          waste_loss: wasteLoss ? Number(wasteLoss) : null,
          voice_transcription: transcript || null,
          confidence_score: extracted?.confidence_score ?? null,
          expense_items: validItems,
        }),
      });

      const logData = await logRes.json();

      if (!logRes.ok) {
        setError(logData.error ?? "Could not save your entry.");
        setStep("confirm");
        return;
      }

      router.push(`/dashboard/result/${logData.profit_log_id}`);
    } catch {
      setError("Network error — please try again.");
      setStep("confirm");
    }
  };

  if (step === "extracting") return <LoadingSpinner label="Reading your numbers…" />;
  if (step === "saving") return <LoadingSpinner label="Saving…" />;

  if (step === "confirm") {
    const previewProfit =
      revenue && costs && !Number.isNaN(Number(revenue)) && !Number.isNaN(Number(costs))
        ? Number(revenue) - Number(costs)
        : null;

    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-5 animate-fade-up">
        <div>
          <h1 className="font-heading text-xl font-bold">Confirm your numbers</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            Edit anything that doesn&apos;t look right.
          </p>
        </div>

        <LogDatePicker value={logDate} onChange={setLogDate} />

        {transcript && (
          <div className="card flex items-start gap-2 text-sm text-foreground-secondary">
            <Quote size={14} className="mt-0.5 shrink-0 text-foreground-muted" />
            <span>{transcript}</span>
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Revenue (₹)</span>
          <input
            type="number"
            inputMode="decimal"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
            className="input-field"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Costs (₹)</span>
          <input
            type="number"
            inputMode="decimal"
            value={costs}
            onChange={(e) => setCosts(e.target.value)}
            className="input-field"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Waste / loss (₹, optional)</span>
          <input
            type="number"
            inputMode="decimal"
            value={wasteLoss}
            onChange={(e) => setWasteLoss(e.target.value)}
            className="input-field"
          />
        </label>

        <ExpenseItemsEditor items={expenseItems} onChange={setExpenseItems} />

        {previewProfit !== null && (
          <div
            className={`flex items-center justify-between rounded-xl px-4 py-3 ${
              previewProfit >= 0 ? "bg-primary-50" : "bg-error-100"
            }`}
          >
            <span
              className={`text-sm font-medium ${previewProfit >= 0 ? "text-primary-700" : "text-error"}`}
            >
              Profit
            </span>
            <span
              className={`font-heading text-lg font-bold ${
                previewProfit >= 0 ? "text-primary-700" : "text-error"
              }`}
            >
              ₹{previewProfit.toLocaleString("en-IN")}
            </span>
          </div>
        )}

        {error && <p className="text-sm text-error">{error}</p>}

        <button type="button" onClick={handleSave} className="btn-primary">
          Confirm & save
        </button>
        <button
          type="button"
          onClick={() => {
            setTranscript("");
            setExtracted(null);
            setRevenue("");
            setCosts("");
            setWasteLoss("");
            setExpenseItems([]);
            setError(null);
            setStep("record");
          }}
          className="flex items-center justify-center gap-1.5 text-sm text-foreground-secondary"
        >
          <ArrowLeft size={14} />
          Start over
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 pt-6">
      <div className="text-center">
        <h1 className="font-heading text-xl font-bold">
          {logDate === todayIST() ? "Log today&apos;s profit" : "Log a past day"}
        </h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Speak your revenue and costs — I&apos;ll do the math.
        </p>
      </div>
      <LogDatePicker value={logDate} onChange={setLogDate} />
      <VoiceInput language={language} onTranscript={handleTranscript} />
    </div>
  );
}

/**
 * Vendors can't always log on the day itself, so any of the last 30 days is
 * allowed (the server enforces the same window). Today/Yesterday chips cover
 * the common case in one tap; the native date input covers the rest.
 */
function LogDatePicker({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const today = todayIST();
  const yesterday = daysAgoIST(1);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "border-primary-500 bg-primary-50 text-primary-700"
        : "border-border-strong text-foreground-secondary hover:bg-surface-hover"
    }`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(today)} className={chip(value === today)}>
          Today
        </button>
        <button type="button" onClick={() => onChange(yesterday)} className={chip(value === yesterday)}>
          Yesterday
        </button>
        <label className={`${chip(value !== today && value !== yesterday)} flex items-center gap-1.5`}>
          <CalendarDays size={14} />
          <input
            type="date"
            value={value}
            min={daysAgoIST(BACKDATE_WINDOW_DAYS)}
            max={today}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            aria-label="Pick a date"
            className="w-[7.5rem] bg-transparent text-sm outline-none"
          />
        </label>
      </div>
      <p className="text-xs text-foreground-muted">
        Logging for{" "}
        {new Date(value + "T00:00:00").toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "short",
        })}
        {value !== today && " · any of the last " + BACKDATE_WINDOW_DAYS + " days works"}
      </p>
    </div>
  );
}
