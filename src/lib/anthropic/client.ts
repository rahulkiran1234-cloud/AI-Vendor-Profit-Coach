import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// claude-sonnet-5: fast + cheap, right fit for the short extraction/insight calls this app makes.
export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

/**
 * Claude is asked to return JSON-only. This strips accidental code fences and
 * parses the first response block, throwing a typed error the caller can catch
 * and fall back on (see PART 11 decision trees: never let a malformed AI
 * response take down the request).
 */
export function parseJsonResponse<T>(rawText: string): T {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
