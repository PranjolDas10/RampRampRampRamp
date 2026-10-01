// Turns the raw event stream into tasks, groups repeated tasks into patterns, and learns the
// rules behind each field. Deterministic: string alignment and counting, no model calls.
import { normalize } from "./trace";
import type { CapturedEvent, Cluster, Episode, FieldRule, MergedRule, Trace } from "./types";

const IDLE_GAP = 3 * 60_000;

export function routeTemplate(route: string) {
  return route
    .split("/")
    .map((seg) => (/\d/.test(seg) ? ":id" : seg))
    .join("/");
}

function tokenOf(e: CapturedEvent): string | null {
  switch (e.type) {
    case "navigate":
      return `open ${routeTemplate(e.route)}`;
    case "click":
      return `click ${e.label}`;
    case "change":
      return `fill ${e.label}`;
    case "copy":
      return "copy";
    case "paste":
      return "paste";
    case "submit":
      return `submit ${e.label}`;
    default:
      return null;
  }
}

// 1. Split the stream into tasks: each successful submit closes one; long idle gaps reset.
export function segment(events: CapturedEvent[]): Episode[] {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const episodes: Episode[] = [];
  let current: CapturedEvent[] = [];
  for (const e of sorted) {
    if (e.type === "automation" || e.type === "submit_failed") continue;
    const last = current[current.length - 1];
    if (last && e.ts - last.ts > IDLE_GAP) current = [];
    current.push(e);
    if (e.type !== "submit") continue;
    const changes = current.filter((c) => c.type === "change" && c.route === e.route);
    if (changes.length >= 3) episodes.push(toEpisode(current, e, changes));
    current = [];
  }
  return episodes;
}

function toEpisode(events: CapturedEvent[], submit: CapturedEvent, changes: CapturedEvent[]): Episode {
  const fields: Episode["fields"] = {};
  const order: string[] = [];
  for (const c of changes) {
    if (!c.label || c.value == null || !c.shape) continue;
    if (!(c.label in fields)) order.push(c.label);
    fields[c.label] = { value: c.value, from: c.from, shape: c.shape, trace: c.trace };
  }
  // The screen most values came from is the task's source (for example, one email).
  const sources = new Map<string, { trace: Trace; n: number }>();
  for (const f of Object.values(fields)) {
    if (!f.trace) continue;
    const s = sources.get(f.trace.route) ?? { trace: f.trace, n: 0 };
    s.n++;
    sources.set(f.trace.route, s);
  }
  const source = [...sources.values()].sort((a, b) => b.n - a.n)[0]?.trace;
  const tokens: string[] = [];
  for (const e of events) {
    const t = tokenOf(e);
    if (t && tokens[tokens.length - 1] !== t) tokens.push(t);
  }
  const start = events[0].ts;
  return {
    id: submit.id,
    start,
    end: submit.ts,
    seconds: Math.max(1, (submit.ts - start) / 1000),
    form: submit.label ?? "Submit",
    emailId: source?.route.split("/").pop(),
    sourceTitle: source?.title,
    fields,
    order,
    tokens,
    copies: events.filter((e) => e.type === "copy").length,
    pastes: events.filter((e) => e.type === "paste").length,
  };
}

// Edit distance over step sequences (each step is one token, like aligning DNA letters).
export function alignmentSimilarity(a: string[], b: string[]) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length, 1);
}

// 2. Group similar tasks. Same form + similar step sequence = same pattern.
export function cluster(episodes: Episode[], threshold = 0.5): Cluster[] {
  const clusters: Cluster[] = [];
  for (const ep of episodes) {
    const home = clusters.find(
      (c) => c.form === ep.form && alignmentSimilarity(c.episodes[0].tokens, ep.tokens) >= threshold,
    );
    if (home) {
      home.episodes.push(ep);
      for (const f of ep.order) if (!home.fieldLabels.includes(f)) home.fieldLabels.push(f);
    } else {
      clusters.push({ id: `cl-${ep.id}`, form: ep.form, episodes: [ep], fieldLabels: [...ep.order] });
    }
  }
  return clusters;
}

function majority<T>(items: T[], key: (t: T) => string) {
  const counts = new Map<string, { item: T; n: number }>();
  for (const it of items) {
    const k = key(it);
    const c = counts.get(k) ?? { item: it, n: 0 };
    c.n++;
    counts.set(k, c);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0];
}

// 3. Learn a rule per field: copied from the source screen, always the same, or decided by
//    another field (a functional dependency, like Vendor → GL Account).
export function learnRules(c: Cluster): FieldRule[] {
  const total = c.episodes.length;
  const rules: FieldRule[] = [];
  for (const field of c.fieldLabels) {
    const runs = c.episodes.filter((e) => e.fields[field]);
    const traced = runs.filter((e) => e.fields[field].trace);
    if (traced.length && traced.length / runs.length >= 0.6) {
      const top = majority(traced, (e) => e.fields[field].trace!.label.toLowerCase())!;
      const f = top.item.fields[field];
      rules.push({ field, kind: "extract", label: f.trace!.label, shape: f.shape, support: top.n, total });
      continue;
    }
    const values = runs.map((e) => normalize(e.fields[field].value, e.fields[field].shape));
    if (runs.length >= 3 && values.every((v) => v === values[0])) {
      rules.push({ field, kind: "constant", value: runs[0].fields[field].value, support: runs.length, total });
      continue;
    }
    const lookup = findDependency(c, field, rules);
    rules.push(lookup ?? { field, kind: "manual", support: 0, total });
  }
  return rules;
}

function findDependency(c: Cluster, field: string, known: FieldRule[]): FieldRule | null {
  for (const by of known.filter((r) => r.kind === "extract").map((r) => r.field)) {
    const map: Record<string, string> = {};
    let consistent = true;
    let support = 0;
    for (const e of c.episodes) {
      const key = e.fields[by]?.value;
      const val = e.fields[field]?.value;
      if (!key || !val) continue;
      if (map[key] && map[key] !== val) consistent = false;
      map[key] = val;
      support++;
    }
    // Needs a repeated key to count as evidence; otherwise any mapping looks "consistent".
    const repeated = support > Object.keys(map).length;
    if (consistent && support > 0) return { field, kind: "lookup", by, map, support: repeated ? support : 0, total: c.episodes.length };
  }
  return null;
}

function strong(r: FieldRule) {
  // A label with digits in it (like "B-24088") is a value, not a field name; don't trust it.
  if (r.kind === "extract") return !/\d/.test(r.label) && (r.support >= 2 || r.support / r.total >= 0.6);
  if (r.kind === "constant") return r.support >= 3;
  if (r.kind === "lookup") return r.support >= 2;
  return false;
}

function sameRule(a: FieldRule, b: FieldRule) {
  if (a.kind !== b.kind) return false;
  if (a.kind === "extract" && b.kind === "extract") return a.label.toLowerCase() === b.label.toLowerCase();
  if (a.kind === "lookup" && b.kind === "lookup") return a.by === b.by;
  return a.kind === "constant";
}

// 4. Personal rules win when the evidence is strong; the team fills gaps and confirms.
export function mergeRules(personal: FieldRule[], team: FieldRule[], fieldOrder: string[]): MergedRule[] {
  return fieldOrder.map((field) => {
    const mine = personal.find((r) => r.field === field);
    const theirs = team.find((r) => r.field === field);
    const teamInfo = theirs ? { teamSupport: theirs.support, teamTotal: theirs.total } : {};
    if (mine && strong(mine)) {
      if (mine.kind === "lookup" && theirs?.kind === "lookup") {
        return { ...mine, map: { ...theirs.map, ...mine.map }, source: "both" as const, ...teamInfo };
      }
      return { ...mine, source: theirs && sameRule(mine, theirs) ? ("both" as const) : ("you" as const), ...teamInfo };
    }
    if (theirs) {
      if (mine && mine.kind === "lookup" && theirs.kind === "lookup") {
        return { ...theirs, map: { ...theirs.map, ...mine.map }, source: "both" as const, ...teamInfo };
      }
      return { ...theirs, source: mine && sameRule(mine, theirs) ? ("both" as const) : ("team" as const), ...teamInfo };
    }
    return { ...(mine ?? { field, kind: "manual" as const, support: 0, total: 0 }), source: "you" as const };
  });
}

export function median(nums: number[]) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Does a personal pattern match a known team pattern? Compare the set of fields touched.
export function fieldOverlap(a: string[], b: string[]) {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / Math.max(new Set([...A, ...B]).size, 1);
}
