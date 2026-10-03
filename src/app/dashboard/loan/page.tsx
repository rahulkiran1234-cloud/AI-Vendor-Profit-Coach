"use client";

import { useEffect, useState } from "react";
import { Landmark, ShieldCheck, CalendarCheck, Gauge, CheckCircle2 } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface EligibilityResponse {
  eligible: boolean;
  eligibility_amount: number;
  daily_average: number;
  consistency_score: number;
  risk_level: "low" | "medium" | "high";
  recommendation: string;
  interest_noted: boolean;
}

const RISK_STYLE: Record<string, string> = {
  low: "badge-primary",
  medium: "badge-warning",
  high: "bg-error-100 text-error",
};

export default function LoanPage() {
  const [data, setData] = useState<EligibilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [interestNoted, setInterestNoted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/loan/eligibility")
      .then(async (res) => {
        if (!res.ok) throw new Error("request_failed");
        return res.json();
      })
      .then((json: EligibilityResponse) => {
        setData(json);
        setInterestNoted(json.interest_noted);
      })
      .catch(() => setError("Could not load loan eligibility."))
      .finally(() => setLoading(false));
  }, []);

  // Records interest only. No lender integration exists yet, so nothing is
  // submitted anywhere — the copy below says so plainly rather than implying
  // an application is in progress.
  const handleInterest = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/loan/interest", { method: "POST" });
      if (!res.ok) throw new Error("request_failed");
      setInterestNoted(true);
    } catch {
      setError("Could not save this. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner label="Calculating your eligibility…" />;
  if (!data) return <p className="text-error">{error ?? "Something went wrong."}</p>;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Loan eligibility</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Built entirely from your logged profit history — no paperwork.
        </p>
      </div>

      <div className="card-elevated flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <Landmark size={22} />
        </div>
        <p className="text-sm text-foreground-secondary">
          {data.eligible
            ? "You're eligible for"
            : data.daily_average <= 0 && data.consistency_score > 0
              ? "Not eligible yet"
              : "Log more days to unlock loan eligibility"}
        </p>
        <p className="font-heading text-4xl font-bold text-primary-600">
          ₹{data.eligibility_amount.toLocaleString("en-IN")}
        </p>
        <span className={`badge ${RISK_STYLE[data.risk_level]} mt-1 capitalize`}>
          <ShieldCheck size={12} />
          {data.risk_level} risk
        </span>
      </div>

      <div className="card grid grid-cols-2 gap-4">
        <Metric icon={Gauge} label="Verified daily profit" value={`₹${data.daily_average.toLocaleString("en-IN")}`} />
        <Metric icon={CalendarCheck} label="Consistency" value={`${data.consistency_score}%`} />
      </div>

      <p className="text-sm text-foreground-secondary">{data.recommendation}</p>

      {interestNoted ? (
        <div className="card flex items-start gap-3 border-primary-100 bg-primary-50/40">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-primary-600" />
          <div>
            <p className="font-medium">We&apos;ve noted your interest</p>
            <p className="mt-1 text-sm text-foreground-secondary">
              Loan applications aren&apos;t open yet, and nothing has been sent to any lender.
              Keep logging daily — your record keeps building, and we&apos;ll let you know when
              applications open.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleInterest}
            disabled={saving || !data.eligible}
            className="btn-primary"
          >
            {saving ? "Saving…" : "I’m interested in a loan"}
          </button>
          <p className="text-center text-xs text-foreground-muted">
            Loan applications open soon. This only lets us know you&apos;re interested — nothing
            is sent to a lender.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-foreground-secondary">
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xs text-foreground-secondary">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}
