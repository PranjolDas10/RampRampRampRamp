export const HOURLY_RATE = 45; // loaded cost per hour, used for every dollar figure

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function fmtMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function fmtMoney0(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function fmtDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function fmtHours(seconds: number) {
  const h = seconds / 3600;
  return h >= 10 ? `${h.toFixed(0)}h` : `${h.toFixed(1)}h`;
}

export function timeAgo(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ISO yyyy-mm-dd → "September 28, 2026" (parsed by hand to avoid time zone shifts)
export function isoToLong(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function isoToMDY(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

export function mdyToIso(mdy: string) {
  const m = mdy.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

export function longToIso(text: string) {
  const m = text.trim().match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),\s*(\d{4})$/);
  if (!m) return null;
  const idx = MONTHS.findIndex((name) => name.toLowerCase().startsWith(m[1].slice(0, 3).toLowerCase()));
  if (idx < 0) return null;
  return `${m[3]}-${String(idx + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

export function clockLabel(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
