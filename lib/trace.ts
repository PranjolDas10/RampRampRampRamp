// Value tracing: find where a typed value was seen on an earlier screen, and pull the same
// value out of a new document using the label learned from that screen. Pure functions, no AI.
import { isoToMDY, longToIso, mdyToIso } from "./format";
import type { Shape, Snapshot, Token, Trace } from "./types";

const MONEY = /\$\s?\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\$\s?\d+(?:\.\d{2})?/g;
const DATE_NUM = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g;
const DATE_LONG = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s*\d{4}\b/g;
const ID = /\b[A-Z]{2,5}-\d{3,7}\b/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;

export function clean(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function detectShape(value: string, label = ""): Shape {
  const v = value.trim();
  if (/^\$?\s?\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\$?\s?\d+(\.\d{1,2})?$/.test(v) && /amount|total|price|cost|\$/i.test(label + v))
    return "currency";
  if (mdyToIso(v) || longToIso(v)) return "date";
  if (/^[A-Z]{2,5}-\d{3,7}$/i.test(v)) return "id";
  if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(v)) return "email";
  return "text";
}

export function normalize(value: string, shape: Shape) {
  const v = value.trim();
  if (shape === "currency") return Number(v.replace(/[^0-9.]/g, "")).toFixed(2);
  if (shape === "date") return mdyToIso(v) ?? longToIso(v) ?? v.toLowerCase();
  return clean(v).toLowerCase();
}

export function extractTokens(lines: string[]): Token[] {
  const tokens: Token[] = [];
  const scan = (re: RegExp, shape: Shape, line: string, i: number) => {
    for (const m of line.matchAll(re)) {
      tokens.push({ raw: m[0], norm: normalize(m[0], shape), shape, line: i, index: m.index ?? 0 });
    }
  };
  lines.forEach((line, i) => {
    scan(MONEY, "currency", line, i);
    scan(DATE_NUM, "date", line, i);
    scan(DATE_LONG, "date", line, i);
    scan(ID, "id", line, i);
    scan(EMAIL, "email", line, i);
  });
  return tokens;
}

export function makeSnapshot(title: string, rawLines: string[]): Snapshot {
  const lines = rawLines.map(clean).filter(Boolean).slice(0, 120);
  return { title, lines, tokens: extractTokens(lines) };
}

// "V-1004 · Acme Roasting Supply" → ["acme roasting supply"]; plain text → [text]
function textParts(norm: string) {
  const parts = norm.split(/\s[·|–—-]\s/).map((p) => p.trim());
  const useful = parts.filter((p) => p.length >= 4 && /[a-z]/.test(p));
  return parts.length > 1 ? useful : norm.length >= 3 ? [norm] : [];
}

type Hit = { line: number; index: number; length: number };

function hitsIn(snapshot: Snapshot, value: string, shape: Shape): Hit[] {
  const norm = normalize(value, shape);
  if (shape === "currency" || shape === "date") {
    return snapshot.tokens
      .filter((t) => t.shape === shape && t.norm === norm)
      .map((t) => ({ line: t.line, index: t.index, length: t.raw.length }));
  }
  const hits: Hit[] = [];
  for (const part of textParts(norm)) {
    snapshot.lines.forEach((line, i) => {
      const at = line.toLowerCase().indexOf(part);
      if (at >= 0) hits.push({ line: i, index: at, length: part.length });
    });
  }
  return hits;
}

function labelBefore(line: string, index: number) {
  return line
    .slice(0, index)
    .trim()
    .replace(/[:\-–—]\s*$/, "")
    .trim();
}

// Pick the line that reads most like "Label: value" rather than a table row or sentence.
function bestHit(snapshot: Snapshot, hits: Hit[]) {
  let best: { hit: Hit; label: string; score: number } | null = null;
  for (const hit of hits) {
    const line = snapshot.lines[hit.line];
    const prefix = line.slice(0, hit.index);
    const label = labelBefore(line, hit.index);
    let score = 0;
    if (!MONEY.test(prefix)) score += 2;
    MONEY.lastIndex = 0;
    if (label.length > 0 && label.length < 24) score += 1;
    if (line.trim().endsWith(line.slice(hit.index, hit.index + hit.length).trim())) score += 1;
    if (label.length === 0) score -= 2;
    // "Label: value" is the strongest sign of a field on a document.
    if (/:\s*$/.test(prefix)) score += 2;
    // A label shouldn't contain values that change per document (ids, dates, amounts).
    if (new RegExp(`${ID.source}|${MONEY.source}|${DATE_LONG.source}|${DATE_NUM.source}`).test(prefix)) score -= 2;
    if (!best || score > best.score) best = { hit, label, score };
  }
  return best;
}

export type Seen = { route: string; snapshot: Snapshot };

// Which earlier screen does this value come from? Prefer the screen that explains the most
// values typed so far in this task; ties go to the most recent screen.
export function traceValue(
  value: string,
  shape: Shape,
  currentRoute: string,
  seen: Seen[],
  episodeValues: { value: string; shape: Shape }[],
): Trace | undefined {
  let best: { trace: Trace; score: number } | undefined;
  for (let i = seen.length - 1; i >= 0; i--) {
    const s = seen[i];
    if (s.route === currentRoute) continue;
    const hit = bestHit(s.snapshot, hitsIn(s.snapshot, value, shape));
    if (!hit) continue;
    const coverage = episodeValues.filter((v) => hitsIn(s.snapshot, v.value, v.shape).length > 0).length;
    const score = coverage * 10 + hit.score;
    if (!best || score > best.score) {
      best = { trace: { route: s.route, title: s.snapshot.title, label: hit.label || "page text" }, score };
    }
  }
  return best?.trace;
}

// Apply a learned label to a new document: "Total due" → "$7,050.00"
export function extractByLabel(lines: string[], label: string, shape: Shape): string | undefined {
  const want = clean(label).toLowerCase();
  for (const raw of lines) {
    const line = clean(raw);
    if (!line.toLowerCase().startsWith(want)) continue;
    const rest = line.slice(want.length).replace(/^\s*[:\-–—]?\s*/, "");
    if (!rest) continue;
    const pick = (re: RegExp) => rest.match(new RegExp(re.source))?.[0];
    if (shape === "currency") return pick(MONEY);
    if (shape === "date") return pick(DATE_LONG) ?? pick(DATE_NUM);
    if (shape === "id") return pick(ID);
    if (shape === "email") return pick(EMAIL);
    return rest;
  }
  return undefined;
}

// Put an extracted value in the format the target field expects.
export function formatFor(shape: Shape, value: string) {
  if (shape === "currency") return Number(value.replace(/[^0-9.]/g, "")).toFixed(2);
  if (shape === "date") {
    const iso = mdyToIso(value) ?? longToIso(value);
    return iso ? isoToMDY(iso) : value;
  }
  return value;
}

// Choose the dropdown option whose name appears in the extracted text.
export function matchOption(options: string[], text: string) {
  const hay = text.toLowerCase();
  return options.find((o) => textParts(o.toLowerCase()).some((p) => hay.includes(p)));
}
