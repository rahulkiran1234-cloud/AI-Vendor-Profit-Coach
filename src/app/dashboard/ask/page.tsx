"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Send, MessageCircleHeart } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { createClient } from "@/lib/supabase/client";

const LANGUAGE_TO_BCP47: Record<string, string> = {
  hindi: "hi-IN",
  marathi: "mr-IN",
  english: "en-IN",
};

interface CoachMessage {
  id: string | null;
  question: string;
  answer: string;
  created_at: string;
}

// Same minimal Web Speech API shape used by VoiceInput, but one-shot (single
// utterance, no confirm step) — the vendor reviews the question text before
// sending anyway, so there's no need for the full record/confirm flow.
interface SpeechRecognitionResultEvent extends Event {
  results: { [index: number]: { [index: number]: { transcript: string } }; length: number };
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
}

const SUGGESTIONS = [
  "Why was my profit low this week?",
  "Which ingredient costs me the most?",
  "Am I logging often enough for a loan?",
];

export default function AskCoachPage() {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dictationLang, setDictationLang] = useState("en-IN");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/coach/history")
      .then(async (res) => {
        if (!res.ok) throw new Error("request_failed");
        return res.json();
      })
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => setError("Could not load your conversation history."))
      .finally(() => setLoadingHistory(false));

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("users")
        .select("language")
        .eq("id", data.user.id)
        .single();
      if (profile?.language) setDictationLang(LANGUAGE_TO_BCP47[profile.language] ?? "en-IN");
    });
  }, []);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, asking]);

  const startDictation = () => {
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;
    if (!Ctor) {
      setError("Voice input isn't supported in this browser — type your question instead.");
      return;
    }

    const recognition = new Ctor();
    recognition.lang = dictationLang;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      setQuestion(transcript);
    };
    recognition.onend = () => setRecording(false);

    recognitionRef.current = recognition;
    setRecording(true);
    setError(null);
    recognition.start();
  };

  const stopDictation = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  const handleAsk = async () => {
    const q = question.trim();
    if (!q || asking) return;

    setAsking(true);
    setError(null);
    setQuestion("");

    try {
      const res = await fetch("/api/coach/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not get an answer.");
        setQuestion(q);
        return;
      }

      setMessages((prev) => [...prev, data]);
    } catch {
      setError("Network error — please try again.");
      setQuestion(q);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-bold">Ask your coach</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Ask anything about your own profit, costs, or loan eligibility.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto rounded-2xl">
        {loadingHistory ? (
          <LoadingSpinner />
        ) : messages.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <MessageCircleHeart size={22} />
            </div>
            <p className="text-sm text-foreground-secondary">
              I can only answer using what you&apos;ve logged — try one of these:
            </p>
            <div className="flex flex-col gap-2 w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQuestion(s)}
                  className="rounded-xl border border-border-strong px-3 py-2 text-left text-sm text-foreground-secondary transition-colors hover:bg-surface-hover"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={m.id ?? i} className="flex flex-col gap-2">
              <div className="self-end rounded-2xl rounded-br-sm bg-primary-50 px-4 py-2.5 text-sm text-primary-700">
                {m.question}
              </div>
              <div className="card self-start rounded-bl-sm text-sm">{m.answer}</div>
            </div>
          ))
        )}

        {asking && (
          <div className="card self-start rounded-bl-sm">
            <LoadingSpinner label="Thinking…" />
          </div>
        )}
        <div ref={listEndRef} />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="sticky bottom-0 flex items-end gap-2 border-t border-border bg-background pt-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAsk();
            }
          }}
          rows={1}
          placeholder="Type or speak your question…"
          className="input-field !h-auto max-h-28 flex-1 resize-none py-3"
        />
        <button
          type="button"
          onClick={recording ? stopDictation : startDictation}
          aria-label={recording ? "Stop recording" : "Ask by voice"}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors ${
            recording ? "bg-error text-white" : "bg-surface-hover text-foreground-secondary"
          }`}
        >
          <Mic size={18} />
        </button>
        <button
          type="button"
          onClick={handleAsk}
          disabled={!question.trim() || asking}
          aria-label="Send"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40"
          style={{ background: "var(--gradient-brand)" }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
