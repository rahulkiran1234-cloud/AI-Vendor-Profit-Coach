import Link from "next/link";
import { Landmark, ChevronRight } from "lucide-react";

export function LoanBadge({
  eligibilityAmount,
  consistencyPercentage,
}: {
  eligibilityAmount: number;
  consistencyPercentage: number;
}) {
  return (
    <Link
      href="/dashboard/loan"
      className="card group flex items-center gap-4 transition-shadow hover:shadow-md"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
        <Landmark size={20} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs text-foreground-secondary">Loan eligibility</p>
        <p className="font-heading text-xl font-bold text-primary-600">
          ₹{eligibilityAmount.toLocaleString("en-IN")}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, consistencyPercentage)}%`,
              background: "var(--gradient-brand)",
            }}
          />
        </div>
        <p className="mt-1 text-xs text-foreground-muted">
          {consistencyPercentage}% logging consistency
        </p>
      </div>

      <ChevronRight
        size={18}
        className="shrink-0 text-foreground-muted transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
