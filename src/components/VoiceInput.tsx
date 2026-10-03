"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal shape of the Web Speech API — not in lib.dom.d.ts by default.
interface SpeechRecognitionResultEvent extends Event {
  results: {
    [index: number]: { [index: number]: { transcript: string }; isFinal: boolean };
    length: number;
  };
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const MAX_RECORDING_SECONDS = 120;

const LANGUAGE_TO_BCP47: Record<string, string> = {
  hindi: "hi-IN",
  marathi: "mr-IN",
  english: "en-IN",
};

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceInput({
  language,
  onTranscript,
}: {
  language: string;
  onTranscript: (text: string) => void;
}) {
  // Must default to `true` (not computed from `window`/the API) so the server-rendered
  // HTML and the client's first hydration pass agree — the actual browser capability
  // check can only run client-side, so it happens in the effect below instead, which
  // corrects this to `false` post-hydration if the API turns out to be missing.
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [manualText, setManualText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      // Intentional exception to react-hooks/set-state-in-effect: browser
      // capability detection cannot happen during SSR, so `supported` must
      // default to `true` and only be corrected client-side, after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = LANGUAGE_TO_BCP47[language] ?? "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setManualText(transcript);
    };

    recognition.onerror = () => {
      setError("Could not hear you clearly. Try again or type it in.");
      stopRecording();
    };

    recognition.onend = () => {
      // Recognition can end on its own (e.g. a pause, common on Android
      // Chrome) without stopRecording() ever being called — the countdown
      // interval must stop here too, or it keeps running orphaned, and a
      // second one starts next time the vendor taps the mic.
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [language, stopRecording]);

  const startRecording = () => {
    setError(null);
    setManualText("");
    setSeconds(0);
    setRecording(true);
    recognitionRef.current?.start();

    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_RECORDING_SECONDS) {
          stopRecording();
        }
        return s + 1;
      });
    }, 1000);
  };

  const handleConfirm = () => {
    if (manualText.trim()) onTranscript(manualText.trim());
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {supported ? (
        <div className="relative flex h-36 w-36 items-center justify-center">
          {recording && (
            <span className="absolute inset-0 animate-ring-pulse rounded-full" />
          )}
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            className={`relative flex h-28 w-28 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95 ${
              recording ? "bg-error" : ""
            }`}
            style={recording ? undefined : { background: "var(--gradient-brand)" }}
            aria-label={recording ? "Stop recording" : "Start recording"}
          >
            <MicIcon />
          </button>
        </div>
      ) : (
        <p className="text-sm text-warning">
          Voice input isn&apos;t supported in this browser. Type your numbers below instead.
        </p>
      )}

      <p className="text-sm font-medium text-foreground-secondary">
        {recording ? `Listening… ${seconds}s / ${MAX_RECORDING_SECONDS}s` : "Tap to speak"}
      </p>

      {error && <p className="text-sm text-error">{error}</p>}

      <textarea
        value={manualText}
        onChange={(e) => setManualText(e.target.value)}
        placeholder="Aaj 40 hazaar revenue, 30 hazaar kharcha…"
        rows={3}
        className="input-field w-full max-w-sm !h-auto py-3"
      />

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!manualText.trim()}
        className="btn-primary max-w-sm"
      >
        Confirm
      </button>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
