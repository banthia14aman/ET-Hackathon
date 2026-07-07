// FROZEN — the ONE formatting canon. Owned by TEAM LEAD.
// Every number/timestamp rendered anywhere in the UI goes through these. No local toFixed().

export function fmtKbd(v: number): string {
  return `${Math.round(v)} kb/d`;
}

export function fmtUsdBbl(v: number): string {
  return `$${v.toFixed(2)}/bbl`;
}

export function fmtDelta(v: number): string {
  const sign = v < 0 ? '-' : '+';
  return `${sign}$${Math.abs(v).toFixed(2)}/bbl`;
}

export function fmtDays(v: number): string {
  return `${Math.round(v)} d`;
}

/** Large USD → compact: 184_000_000 -> '$184M', 1_240_000_000 -> '$1.24B'. */
export function fmtUsdBig(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${Math.round(v / 1e6)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}k`;
  return `$${Math.round(v)}`;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** '2026-01-19T14:22:00Z' -> '14:22Z · 19:52 IST' (IST = UTC+05:30, deterministic, no locale). */
export function fmtTs(iso: string): string {
  const d = new Date(iso);
  const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes();
  const istMin = (utcMin + 330) % 1440;
  return `${pad2(Math.floor(utcMin / 60))}:${pad2(utcMin % 60)}Z · ${pad2(Math.floor(istMin / 60))}:${pad2(istMin % 60)} IST`;
}
