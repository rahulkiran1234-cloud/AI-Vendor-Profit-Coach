import Link from "next/link";
import {
  Mic,
  CalendarCheck,
  CalendarPlus,
  Wallet,
  MessageCircleHeart,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { computeLoanEligibility } from "@/lib/loan";
import { computeTrendStats } from "@/lib/trend";
import { daysAgoIST, todayIST } from "@/lib/date";
import { ProfitCard } from "@/components/ProfitCard";
import { LoanBadge } from "@/components/LoanBadge";
import type { ProfitLogSummary } from "@/lib/types";

export default async function DashboardHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: history }, { data: profile }] = await Promise.all([
    supabase
      .from("profit_logs")
      .select("date, revenue, costs, profit")
      .eq("user_id", user!.id)
      .gte("date", daysAgoIST(30))
      .order("date", { ascending: false }),
    supabase.from("users").select("full_name").eq("id", user!.id).single(),
  ]);

  const logs = (history ?? []) as ProfitLogSummary[];
  const latest = logs[0];
  const { avg7Day, changePercent } = latest
    ? computeTrendStats(logs, latest)
    : { avg7Day: 0, changePercent: null };
  const loanResult = computeLoanEligibility(logs);
  // Vendors can't always log on the day itself. Only nudge once they've
  // started logging (a brand-new vendor has no "missed" yesterday), and only
  // when yesterday is genuinely missing.
  const yesterday = daysAgoIST(1);
  const missedYesterday = logs.length > 0 && !logs.some((l) => l.date === yesterday);
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">
          {firstName ? `Namaste, ${firstName}` : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Here&apos;s how your business is doing.
        </p>
      </div>

      {latest ? (
        <ProfitCard
          profit={latest.profit}
          date={formatDate(latest.date)}
          changePercent={changePercent}
          label={latest.date === todayIST() ? "Today's profit" : "Latest profit"}
        />
      ) : (
        <div className="card-elevated flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <Mic size={26} />
          </div>
          <div>
            <p className="font-heading font-semibold">No entries yet</p>
            <p className="mt-1 text-sm text-foreground-secondary">
              Log your first day to start building your profit history.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="stat-tile flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <Wallet size={18} />
          </div>
          <div>
            <p className="text-xs text-foreground-secondary">7-day average</p>
            <p className="font-heading text-lg font-bold">
              ₹{Math.round(avg7Day).toLocaleString("en-IN")}
            </p>
          </div>
        </div>
        <div className="stat-tile flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-100 text-warning">
            <CalendarCheck size={18} />
          </div>
          <div>
            <p className="text-xs text-foreground-secondary">Days logged (30d)</p>
            <p className="font-heading text-lg font-bold">{logs.length}</p>
          </div>
        </div>
      </div>

      <Link href="/dashboard/voice-input" className="btn-primary">
        <Mic size={18} />
        Log today&apos;s profit
      </Link>

      {missedYesterday && (
        <Link
          href={`/dashboard/voice-input?date=${yesterday}`}
          className="-mt-2 flex items-center justify-center gap-1.5 text-sm font-medium text-primary-600"
        >
          <CalendarPlus size={15} />
          You haven&apos;t logged yesterday — add it now
        </Link>
      )}

      {logs.length > 0 && (
        <LoanBadge
          eligibilityAmount={loanResult.loan_eligibility_amount}
          consistencyPercentage={loanResult.consistency_percentage}
        />
      )}

      <Link
        href="/dashboard/ask"
        className="card group flex items-center gap-3 transition-shadow hover:shadow-md"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <MessageCircleHeart size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Ask your coach</p>
          <p className="text-xs text-foreground-secondary">
            Ask anything about your profit, costs, or loan.
          </p>
        </div>
        <ChevronRight
          size={18}
          className="shrink-0 text-foreground-muted transition-transform group-hover:translate-x-0.5"
        />
      </Link>
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
