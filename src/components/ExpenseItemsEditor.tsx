"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ExtractedExpenseItem } from "@/lib/types";
import type { ExpenseUnit } from "@/lib/database.types";

const UNITS: ExpenseUnit[] = ["kg", "g", "l", "ml", "piece", "dozen", "packet", "other"];

const EMPTY_ITEM: ExtractedExpenseItem = { item_name: "", amount: 0, quantity: null, unit: null };

export function ExpenseItemsEditor({
  items,
  onChange,
}: {
  items: ExtractedExpenseItem[];
  onChange: (items: ExtractedExpenseItem[]) => void;
}) {
  const updateItem = (index: number, patch: Partial<ExtractedExpenseItem>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([...items, { ...EMPTY_ITEM }]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Itemized expenses (optional)</span>
        <span className="text-xs text-foreground-muted">Helps spot overspending</span>
      </div>

      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-border-strong px-3 py-4 text-center text-xs text-foreground-muted">
          No items added. Add one if you remember what you paid for ingredients or supplies.
        </p>
      )}

      {items.map((item, index) => (
        <div key={index} className="card flex flex-col gap-2 !p-3">
          <div className="flex items-center gap-2">
            <input
              value={item.item_name}
              onChange={(e) => updateItem(index, { item_name: e.target.value })}
              placeholder="e.g. onions"
              className="input-field h-10 flex-1 !px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              aria-label="Remove item"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-hover hover:text-error"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={item.amount || ""}
              onChange={(e) => updateItem(index, { amount: Number(e.target.value) || 0 })}
              placeholder="Amount (₹)"
              className="input-field h-10 flex-1 !px-3 text-sm"
            />
            <input
              type="number"
              inputMode="decimal"
              min={0.001}
              step="any"
              value={item.quantity ?? ""}
              onChange={(e) =>
                updateItem(index, {
                  quantity: e.target.value && Number(e.target.value) > 0 ? Number(e.target.value) : null,
                })
              }
              placeholder="Qty"
              className="input-field h-10 w-20 !px-3 text-sm"
            />
            <select
              value={item.unit ?? ""}
              onChange={(e) =>
                updateItem(index, { unit: (e.target.value || null) as ExpenseUnit | null })
              }
              className="input-field h-10 w-24 !px-2 text-sm"
            >
              <option value="">Unit</option>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong py-2.5 text-sm font-medium text-foreground-secondary transition-colors hover:bg-surface-hover"
      >
        <Plus size={15} />
        Add item
      </button>
    </div>
  );
}
