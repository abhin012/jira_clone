
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

export function localDatetimeInputToIso(
  localValue: string | null | undefined,
): string | null {
  if (!localValue) return null;
  const date = new Date(localValue);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}
