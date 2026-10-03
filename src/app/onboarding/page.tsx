"use client";

import { useState } from "react";
import { Soup, Store, Truck, MoreHorizontal, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import type { Language, VendorType } from "@/lib/database.types";

const VENDOR_OPTIONS: { value: VendorType; label: string; icon: typeof Soup }[] = [
  { value: "street_food", label: "Street food", icon: Soup },
  { value: "retail", label: "Retail / micro-shop", icon: Store },
  { value: "multi_location", label: "Multiple carts", icon: Truck },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: "hindi", label: "हिंदी Hindi" },
  { value: "marathi", label: "मराठी Marathi" },
  { value: "english", label: "English" },
];

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [vendorType, setVendorType] = useState<VendorType>("street_food");
  const [language, setLanguage] = useState<Language>("hindi");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("Still signing you in — please wait a moment and try again.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const { error: upsertError } = await supabase.from("users").upsert({
      id: user.id,
      email: user.email!,
      full_name: fullName,
      vendor_type: vendorType,
      language,
    });

    setSubmitting(false);

    if (upsertError) {
      setError("Could not save your profile. Please try again.");
      return;
    }

    // Intentionally a hard navigation, not router.push: middleware re-checks
    // whether a profile exists on every request, and a client-side soft
    // navigation right after the insert risked that check running against a
    // cached pre-insert RSC response and bouncing back to /onboarding. A
    // full request cycle has no such cache to race against. Verified live:
    // router.push here reproduced the bounce; window.location.href didn't.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/dashboard";
  };

  return (
    <main className="flex min-h-screen flex-col items-center px-6 py-12">
      <div className="mb-10">
        <Logo />
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md animate-fade-up">
        <h1 className="font-heading text-2xl font-bold">Tell us about your business</h1>
        <p className="mt-1 text-sm text-foreground-secondary">Takes less than a minute.</p>

        <div className="card mt-6 flex flex-col gap-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Your full name</span>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field"
              placeholder="Rajesh Kumar"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">What do you sell?</span>
            <div className="grid grid-cols-2 gap-2">
              {VENDOR_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = vendorType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVendorType(opt.value)}
                    className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center text-sm font-medium transition-colors ${
                      active
                        ? "border-primary-500 bg-primary-50 text-primary-700"
                        : "border-border-strong text-foreground-secondary hover:bg-surface-hover"
                    }`}
                  >
                    <Icon size={20} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Preferred language</span>
            <div className="flex gap-2">
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLanguage(opt.value)}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    language === opt.value
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-border-strong text-foreground-secondary hover:bg-surface-hover"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <button type="submit" disabled={submitting || authLoading} className="btn-primary">
            {submitting ? "Saving…" : "Start logging"}
            {!submitting && <ArrowRight size={16} />}
          </button>
        </div>
      </form>
    </main>
  );
}
