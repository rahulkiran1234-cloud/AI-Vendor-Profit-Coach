import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Records that the vendor is interested in a loan. This is deliberately NOT a
 * lender application and sends nothing to anyone — no lender integration
 * exists yet, so the honest thing to store is "this vendor asked", not a
 * fabricated submission. (An earlier mock here claimed an application was
 * "received" with a made-up reference; vendors could have believed they had
 * actually applied.) When a real lender integration is built it gets its own
 * route and writes the kissth_* columns only for genuine submissions.
 */
export async function POST() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const { data: loanRecord } = await supabase
    .from("loan_records")
    .select("loan_eligibility_amount, loan_interest_at")
    .eq("user_id", user.id)
    .single();

  if (!loanRecord || !loanRecord.loan_eligibility_amount) {
    return NextResponse.json(
      { error: "Check your loan eligibility first." },
      { status: 400 },
    );
  }

  // Idempotent: a double-tap or repeat POST keeps the original timestamp.
  if (loanRecord.loan_interest_at) {
    return NextResponse.json({ interest_noted: true, noted_at: loanRecord.loan_interest_at });
  }

  // Service-role write: loan_records is read-only for the vendor's own session
  // (see migration 0008).
  const notedAt = new Date().toISOString();
  const { error } = await createServiceClient()
    .from("loan_records")
    .update({ loan_interest_at: notedAt })
    .eq("user_id", user.id);

  if (error) {
    console.error("loan interest update failed:", error);
    return NextResponse.json({ error: "Could not save this. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ interest_noted: true, noted_at: notedAt });
}
