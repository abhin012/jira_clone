// Conversions between what an <input type="datetime-local"> needs and what
// the server actually stores.
//
// The server stores `dueDate` as an absolute instant (an ISO string with a
// timezone, e.g. "2026-09-15T12:30:00.000Z") and compares it against
// Instant.now() to decide when to fire due-date reminders. A
// datetime-local input, on the other hand, always shows/accepts a
// timezone-LESS local wall-clock string ("2026-09-15T18:00") — it has no
// concept of timezone at all. Passing one straight to the other silently
// mislabels the user's local time as if it were UTC, which is exactly what
// caused reminders to fire hours off from what the user actually meant
// (e.g. an IST user's "6:00 PM" got stored and compared as 6:00 PM UTC —
// 11:30 PM IST). These two functions are the only place that conversion
// should happen; every datetime-local due-date field in the app should go
// through both of them rather than touching the raw ISO string directly.

// Server ISO instant -> local wall-clock string for the input's value/min/max.
export function toLocalDatetimeInputValue(
  isoUtc: string | null | undefined,
): string {
  if (!isoUtc) return "";
  const date = new Date(isoUtc);
  if (isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

// Local wall-clock string from the input -> UTC ISO instant for the server.
// `new Date(localValue)` on a timezone-less string like "2026-09-15T18:00"
// is interpreted by the JS engine as the BROWSER's own local time, which is
// exactly the (correct) assumption we want here — that's what makes this
// the inverse of toLocalDatetimeInputValue above.
export function localDatetimeInputToIso(
  localValue: string | null | undefined,
): string | null {
  if (!localValue) return null;
  const date = new Date(localValue);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}
