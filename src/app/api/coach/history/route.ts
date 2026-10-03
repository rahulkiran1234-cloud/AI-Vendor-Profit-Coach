import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";

const HISTORY_LIMIT = 20;

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const { data, error } = await supabase
    .from("coach_messages")
    .select("id, question, answer, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    console.error("coach_messages fetch failed:", error);
    return NextResponse.json({ error: "Could not load conversation history." }, { status: 500 });
  }

  return NextResponse.json({ messages: (data ?? []).reverse() });
}
