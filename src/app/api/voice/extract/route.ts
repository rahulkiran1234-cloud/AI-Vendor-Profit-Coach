import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { extractProfitFromTranscription } from "@/lib/anthropic/prompts";

// A real spoken transcript of up to 120s (the VoiceInput cap) is at most a
// few hundred words — this is a generous ceiling, not a tight one. Found via
// security review: this route had no length cap at all, so a client could
// send an arbitrarily large body straight into every extraction call.
const MAX_TRANSCRIPTION_LENGTH = 2000;

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const transcription = body?.transcription;

  if (typeof transcription !== "string" || !transcription.trim()) {
    return NextResponse.json({ error: "Missing transcription" }, { status: 400 });
  }
  if (transcription.length > MAX_TRANSCRIPTION_LENGTH) {
    return NextResponse.json({ error: "Transcription is too long." }, { status: 400 });
  }

  try {
    const extracted = await extractProfitFromTranscription(transcription);
    return NextResponse.json(extracted);
  } catch (err) {
    console.error("Claude extraction failed:", err);
    return NextResponse.json(
      { error: "AI extraction temporarily unavailable. Enter the numbers manually." },
      { status: 502 },
    );
  }
}
