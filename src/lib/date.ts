// This app is India-only. "Today" must mean the vendor's calendar day in
// India (UTC+5:30, no DST), not the server's local time or raw UTC — found
// via code review that every `new Date().toISOString().slice(0, 10)` call
// site used UTC, so a vendor logging between 00:00 and 05:30 IST got
// yesterday's date, could get a false "already logged today" 409, and the
// server's daily rate-limit windows reset at 05:30 IST instead of midnight.

const IST_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date as YYYY-MM-DD in India time. */
export function todayIST(): string {
  return IST_FORMATTER.format(new Date());
}

/** The date N days before today, as YYYY-MM-DD in India time. */
export function daysAgoIST(n: number): string {
  return IST_FORMATTER.format(new Date(Date.now() - n * 86_400_000));
}

/** `dateStr` (YYYY-MM-DD) shifted by `days` (negative = earlier). Pure calendar arithmetic. */
export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** True if `dateStr` (YYYY-MM-DD) is strictly after today in India time. */
export function isFutureDateIST(dateStr: string): boolean {
  return dateStr > todayIST();
}

/**
 * The UTC instant corresponding to midnight in India time today — for
 * "has this user done N things since their day started" counters. Shifting
 * by the fixed +5:30 offset and truncating in UTC fields, then shifting back,
 * avoids DST-table complexity India doesn't have anyway.
 */
export function startOfTodayISTAsUTC(): Date {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const shifted = new Date(Date.now() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * How far back a vendor can log a missed day. 30 days matches every other
 * window in the app (loan consistency, trends, history) — an older entry
 * would be accepted but never counted by anything.
 */
export const BACKDATE_WINDOW_DAYS = 30;

/**
 * Validates a date is a real, well-formed YYYY-MM-DD, not in the future, and
 * not older than the backdate window. Vendors can't always log on the day
 * itself, so past dates are deliberately allowed.
 */
export function isValidLogDate(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== "string" || !DATE_RE.test(dateStr)) return false;
  const d = new Date(dateStr + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  // Reject e.g. "2026-02-30" being silently normalized by Date to March 2.
  if (d.toISOString().slice(0, 10) !== dateStr) return false;
  if (isFutureDateIST(dateStr)) return false;
  return dateStr >= daysAgoIST(BACKDATE_WINDOW_DAYS);
}
