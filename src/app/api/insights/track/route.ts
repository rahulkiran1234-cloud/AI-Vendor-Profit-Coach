import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import type { Database } from "@/lib/database.types";

type InsightUpdate = Database["public"]["Tables"]["insights"]["Update"];

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const body = await request.json().catch(() => null);
  const insightId = body?.insight_id;

  if (typeof insightId !== "string") {
    return NextResponse.json({ error: "Missing insight_id" }, { status: 400 });
  }

  const update: InsightUpdate = {};
  if (body.viewed === true) update.viewed_at = new Date().toISOString();
  if (typeof body.acted_upon === "boolean") {
    update.acted_upon = body.acted_upon;
    if (body.acted_upon) update.action_date = new Date().toISOString();
  }
  if (typeof body.action_description === "string") {
    update.action_description = body.action_description;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("insights")
    .update(update)
    .eq("id", insightId)
    .eq("user_id", user.id);

  if (error) {
    console.error("insights update failed:", error);
    return NextResponse.json({ error: "Could not update insight." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
