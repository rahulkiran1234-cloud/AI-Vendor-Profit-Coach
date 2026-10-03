"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return { error: null };
    // An unconfirmed account gets a different (accurate) message than a wrong
    // password — "check your password" sent people in circles when the real
    // problem was the confirmation email they hadn't opened.
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Please confirm your email first — open the link we sent you (check spam too)."
          : "Could not sign in. Check your email and password.",
    };
  };

  const signUpWithPassword = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      return { error: "Could not create account. Try a different email.", needsConfirmation: false };
    }
    // With email confirmation on, Supabase reports success for an already
    // registered address but returns a user with no identities.
    if (data.user && data.user.identities?.length === 0) {
      return { error: "This email already has an account — try logging in.", needsConfirmation: false };
    }
    // No session means the vendor must open the confirmation email before
    // they can use the app. Previously the UI ignored this and navigated on,
    // landing them back on the login page with no explanation.
    return { error: null, needsConfirmation: !data.session };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signInWithGoogle, signInWithPassword, signUpWithPassword, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
