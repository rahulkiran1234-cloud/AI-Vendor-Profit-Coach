import { TrendingDown, TrendingUp } from "lucide-react";

export function ProfitCard({
  profit,
  date,
  changePercent,
  label = "Today's profit",
}: {
  profit: number;
  date?: string;
  changePercent?: number | null;
  label?: string;
}) {
  const isPositive = profit >= 0;

  return (
    <div className="card-elevated relative flex flex-col items-center gap-2 overflow-hidden text-center">
      <div
        className="pointer-events-none absolute -top-20 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full opacity-[0.07]"
        style={{ background: "var(--gradient-brand)" }}
      />
      {date && <p className="text-sm text-foreground-secondary">{date}</p>}
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        {label}
      </p>
      <p
        className={`font-heading text-5xl font-bold tracking-tight ${
          isPositive ? "text-primary-600" : "text-error"
        }`}
      >
        ₹{Math.abs(profit).toLocaleString("en-IN")}
        {!isPositive && <span className="text-2xl"> loss</span>}
      </p>

      {typeof changePercent === "number" && (
        <div
          className={`badge ${changePercent >= 0 ? "badge-primary" : "bg-error-100 text-error"}`}
        >
          {changePercent >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {Math.abs(Math.round(changePercent))}% vs your average
        </div>
      )}
    </div>
  );
}
