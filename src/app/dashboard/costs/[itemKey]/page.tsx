import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gauge, Receipt, ShoppingBasket, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { daysAgoIST } from "@/lib/date";
import type { ExpenseUnit } from "@/lib/database.types";
import type { ItemPurchase } from "@/lib/types";

const LOOKBACK_DAYS = 30;

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ itemKey: string }>;
}) {
  const { itemKey } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data } = await supabase
    .from("expense_items")
    .select("item_name, date, amount, quantity, unit, unit_price, supplier_name")
    .eq("user_id", user.id)
    .eq("canonical_item_key", itemKey)
    .gte("date", daysAgoIST(LOOKBACK_DAYS))
    .order("date", { ascending: false });

  const purchases = (data ?? []) as (ItemPurchase & { item_name: string })[];

  if (purchases.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <BackLink />
        <div className="card py-10 text-center text-foreground-secondary">
          No purchases logged for this item in the last {LOOKBACK_DAYS} days.
        </div>
      </div>
    );
  }

  const displayName = purchases[0].item_name;
  const totalAmount = purchases.reduce((s, p) => s + p.amount, 0);

  // Same mixed-unit-safety rule as computeTopExpenseItems: only average
  // unit_price entries sharing the unit with the most data points.
  const pricesByUnit = new Map<ExpenseUnit, number[]>();
  for (const p of purchases) {
    if (p.unit && p.unit_price != null) {
      const list = pricesByUnit.get(p.unit) ?? [];
      list.push(p.unit_price);
      pricesByUnit.set(p.unit, list);
    }
  }
  let commonUnit: ExpenseUnit | null = null;
  let commonPrices: number[] = [];
  for (const [unit, prices] of pricesByUnit) {
    if (prices.length > commonPrices.length) {
      commonUnit = unit;
      commonPrices = prices;
    }
  }
  const avgUnitPrice = commonPrices.length
    ? Math.round((commonPrices.reduce((s, v) => s + v, 0) / commonPrices.length) * 100) / 100
    : null;

  let benchmark: { avg_unit_price: number; vendor_count: number } | null = null;
  if (commonUnit) {
    const { data: benchmarkRows } = await supabase.rpc("get_item_price_benchmark", {
      p_item_name: itemKey,
      p_unit: commonUnit,
    });
    const row = benchmarkRows?.[0];
    if (row && row.vendor_count >= 3 && row.avg_unit_price) {
      benchmark = { avg_unit_price: Math.round(row.avg_unit_price * 100) / 100, vendor_count: row.vendor_count };
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <BackLink />

      <div>
        <h1 className="font-heading text-2xl font-bold capitalize">{displayName}</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Every purchase in the last {LOOKBACK_DAYS} days.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Stat icon={Receipt} label="Total spend" value={`₹${totalAmount.toLocaleString("en-IN")}`} />
        <Stat icon={ShoppingBasket} label="Purchases" value={String(purchases.length)} />
        {avgUnitPrice && commonUnit && (
          <Stat icon={Gauge} label="Avg price" value={`₹${avgUnitPrice}/${commonUnit}`} />
        )}
        {benchmark && commonUnit && (
          <Stat
            icon={TrendingUp}
            label={`Nearby avg (${benchmark.vendor_count} vendors)`}
            value={`₹${benchmark.avg_unit_price}/${commonUnit}`}
          />
        )}
      </div>

      {commonPrices.length > 1 && (
        <div className="card">
          <p className="mb-3 text-sm font-medium text-foreground-secondary">Price trend</p>
          <PriceSparkline purchases={purchases} unit={commonUnit!} />
        </div>
      )}

      <div className="card flex flex-col divide-y divide-border p-0">
        {purchases.map((p, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <p className="font-medium">
                {new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </p>
              <p className="text-xs text-foreground-secondary">
                {p.quantity && p.unit ? `${p.quantity} ${p.unit}` : "—"}
                {p.supplier_name && ` · ${p.supplier_name}`}
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium">₹{p.amount.toLocaleString("en-IN")}</p>
              {p.unit_price != null && (
                <p className="text-xs text-foreground-muted">
                  ₹{p.unit_price}/{p.unit}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/dashboard/costs"
      className="flex items-center gap-1.5 text-sm text-foreground-secondary"
    >
      <ArrowLeft size={14} />
      All expenses
    </Link>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
}) {
  return (
    <div className="stat-tile flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-foreground-secondary">{label}</p>
        <p className="font-heading text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

function PriceSparkline({
  purchases,
  unit,
}: {
  purchases: ItemPurchase[];
  unit: ExpenseUnit;
}) {
  const sorted = [...purchases]
    .filter((p) => p.unit === unit && p.unit_price != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const values = sorted.map((p) => p.unit_price!);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const width = 300;
  const height = 70;
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  const points = values.map((v, i) => [i * step, height - ((v - min) / range) * height]);
  const linePoints = points.map((p) => p.join(",")).join(" ");
  const areaPoints = `0,${height} ${linePoints} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="item-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary-500)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--primary-500)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#item-spark-fill)" />
      <polyline
        points={linePoints}
        fill="none"
        stroke="var(--primary-500)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
