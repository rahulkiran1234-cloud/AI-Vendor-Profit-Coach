"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import type { Language, VendorType } from "@/lib/database.types";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [vendorType, setVendorType] = useState<VendorType>("street_food");
  const [language, setLanguage] = useState<Language>("hindi");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("users")
      .select("full_name, vendor_type, language")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name);
          setVendorType(data.vendor_type ?? "street_food");
          setLanguage(data.language);
        }
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("users")
      .update({ full_name: fullName, vendor_type: vendorType, language })
      .eq("id", user.id);

    setSaving(false);
    setMessage(error ? "Could not save changes." : "Saved!");
  };

  const handleExport = async () => {
    const { data } = await supabase
      .from("profit_logs")
      .select("*")
      .eq("user_id", user!.id)
      .order("date", { ascending: false });

    const blob = new Blob([JSON.stringify(data ?? [], null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "profit-history.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Manage your profile and data.
        </p>
      </div>

      <form onSubmit={handleSave} className="card flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          Profile
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Full name</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input-field"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Vendor type</span>
          <select
            value={vendorType}
            onChange={(e) => setVendorType(e.target.value as VendorType)}
            className="input-field"
          >
            <option value="street_food">Street food</option>
            <option value="retail">Retail / micro-shop</option>
            <option value="multi_location">Multiple carts / locations</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="input-field"
          >
            <option value="hindi">Hindi</option>
            <option value="marathi">Marathi</option>
            <option value="english">English</option>
          </select>
        </label>

        {message && <p className="text-sm text-primary-600">{message}</p>}

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <div className="card flex flex-col divide-y divide-border p-0">
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-3 px-5 py-4 text-left text-sm font-medium transition-colors hover:bg-surface-hover"
        >
          <Download size={16} className="text-foreground-secondary" />
          Export my data
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 px-5 py-4 text-left text-sm font-medium text-error transition-colors hover:bg-surface-hover"
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>
    </div>
  );
}
