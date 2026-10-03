import { Sparkles, Lightbulb } from "lucide-react";

export function InsightDisplay({
  insightText,
  recommendation,
}: {
  insightText: string;
  recommendation?: { text: string; savings: number } | null;
}) {
  return (
    <div className="card flex flex-col gap-4 border-primary-100 bg-primary-50/40 animate-fade-up">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
          <Sparkles size={16} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
            Your insight
          </p>
          <p className="mt-0.5 font-medium leading-snug">{insightText}</p>
        </div>
      </div>

      {recommendation && (
        <div className="flex items-start gap-3 rounded-xl bg-warning-100 p-3">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium text-warning">{recommendation.text}</p>
            <p className="mt-1 text-xs text-foreground-secondary">
              Estimated savings: ₹{recommendation.savings.toLocaleString("en-IN")}/year
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function FirstEntryPlaceholder() {
  return (
    <div className="card flex items-center gap-3 animate-fade-up">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
        <Sparkles size={16} />
      </div>
      <p className="text-sm text-foreground-secondary">
        First entry logged! Keep logging daily — insights unlock after a week of data.
      </p>
    </div>
  );
}
