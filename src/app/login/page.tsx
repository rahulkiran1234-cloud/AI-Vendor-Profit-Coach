"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, TrendingUp, Landmark, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";

const FEATURES = [
  {
    icon: Mic,
    title: "Log profit by speaking",
    body: "No typing, no spreadsheets — just say today's numbers in Hindi, Marathi, or English.",
  },
  {
    icon: TrendingUp,
    title: "See patterns you'd otherwise miss",
    body: "Every entry is compared against your own history, so you know if today was actually good.",
  },
  {
    icon: Landmark,
    title: "Build a verifiable track record",
    body: "Consistent logging turns into a real loan-eligibility number — no paperwork required.",
  },
];

export default function LoginPage() {
  const { signInWithGoogle, signInWithPassword, signUpWithPassword } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result =
      mode === "login"
        ? await signInWithPassword(email, password)
        : await signUpWithPassword(email, password);

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.push(mode === "login" ? "/dashboard" : "/onboarding");
  };

  return (
    <main className="flex min-h-screen">
      {/* Brand panel — hidden on small screens */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_20%_20%,var(--primary-600),var(--primary-700)_60%)] p-12 text-white lg:flex">
        <Logo size={34} />

        <div className="flex flex-col gap-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <f.icon size={20} />
              </div>
              <div>
                <p className="font-heading font-semibold">{f.title}</p>
                <p className="mt-1 text-sm text-white/75">{f.body}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-white/50">
          Built for street vendors, micro-retailers, and multi-cart operators across India.
        </p>

        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-white/5" />
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="mb-10 lg:hidden">
          <Logo />
        </div>

        <div className="w-full max-w-sm animate-fade-up">
          <h1 className="font-heading text-2xl font-bold">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            {mode === "login"
              ? "Log in to see today's numbers."
              : "Takes under a minute to get started."}
          </p>

          <div className="mt-6 flex gap-1 rounded-xl border border-border bg-surface-hover p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === "login" ? "bg-surface shadow-sm" : "text-foreground-secondary"
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === "signup" ? "bg-surface shadow-sm" : "text-foreground-secondary"
              }`}
            >
              Sign up
            </button>
          </div>

          <button type="button" onClick={signInWithGoogle} className="btn-secondary mt-6">
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-foreground-muted">
            <div className="h-px flex-1 bg-border" />
            or use email
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
            />
            {error && <p className="text-sm text-error">{error}</p>}
            <button type="submit" disabled={submitting} className="btn-primary mt-1">
              {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
              {!submitting && <ArrowRight size={16} />}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.61z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}
