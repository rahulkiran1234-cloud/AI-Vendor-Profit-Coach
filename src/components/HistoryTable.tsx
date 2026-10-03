"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DeleteLogButton } from "@/components/DeleteLogButton";
import type { ProfitLogSummary } from "@/lib/types";

interface DayExpenseItem {
  item_name: string;
  amount: number;
  quantity: number | null;
  unit: string | null;
}

export function HistoryTable({
  logs,
  itemsByDate,
}: {
  logs: (ProfitLogSummary & { id: string })[];
  itemsByDate: Record<string, DayExpenseItem[]>;
}) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-foreground-secondary">
          <th className="w-8 px-2 py-3" />
          <th className="px-4 py-3 font-medium">Date</th>
          <th className="px-4 py-3 font-medium">Revenue</th>
          <th className="px-4 py-3 font-medium">Costs</th>
          <th className="px-4 py-3 font-medium">Profit</th>
          <th className="px-2 py-3" />
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => {
          const items = itemsByDate[log.date] ?? [];
          const isExpanded = expandedDate === log.date;

          return (
            <Fragment key={log.date}>
              <tr
                onClick={() => items.length > 0 && setExpandedDate(isExpanded ? null : log.date)}
                className={`border-b border-border last:border-0 ${
                  items.length > 0 ? "cursor-pointer hover:bg-surface-hover" : ""
                }`}
              >
                <td className="px-2 py-3 text-foreground-muted">
                  {items.length > 0 &&
                    (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {new Date(log.date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  ₹{log.revenue.toLocaleString("en-IN")}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  ₹{log.costs.toLocaleString("en-IN")}
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-3 font-medium ${
                    log.profit >= 0 ? "text-primary-600" : "text-error"
                  }`}
                >
                  ₹{log.profit.toLocaleString("en-IN")}
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right">
                  <DeleteLogButton logId={log.id} />
                </td>
              </tr>
              {isExpanded && (
                <tr className="border-b border-border bg-surface-hover/50">
                  <td colSpan={6} className="px-4 py-3">
                    <ul className="flex flex-col gap-1.5">
                      {items.map((item, i) => (
                        <li key={i} className="flex items-center justify-between text-xs">
                          <span className="capitalize text-foreground-secondary">
                            {item.item_name}
                            {item.quantity && item.unit && (
                              <span className="text-foreground-muted">
                                {" "}
                                — {item.quantity} {item.unit}
                              </span>
                            )}
                          </span>
                          <span className="font-medium">
                            ₹{item.amount.toLocaleString("en-IN")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
