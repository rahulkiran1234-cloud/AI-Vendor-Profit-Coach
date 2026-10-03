import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Deletes one day's entry. The itemized expenses and the trend insight for
 * that day go with it (both reference profit_logs with `on delete cascade`),
 * and the date becomes free to log again — which is how a wrong entry gets
 * corrected: delete it, then log that day again.
 *
 * Loan eligibility isn't touched here; it's recomputed from profit_logs every
 * time it's requested, so it reflects the deletion on the next view.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid entry id." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profit_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, date");

  if (error) {
    console.error("profit_logs delete failed:", error);
    return NextResponse.json({ error: "Could not delete this entry." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, date: data[0].date });
}
