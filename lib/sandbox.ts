// Runs the real cl1ck engine on in-memory data for the sandbox walkthrough.
// Pure: builds events in memory and never writes to localStorage or the live demo state.
import { guardrails, missingFields, proposalToBill, propose, REQUIRED_FIELDS, type Proposal } from "./automation";
import { isoToMDY } from "./format";
import { alignmentSimilarity, cluster, learnRules, mergeRules, segment } from "./miner";
import {
  ACCOUNT_OPTIONS,
  BILL_FORM_FIELDS,
  INITIAL_BILLS,
  INITIAL_EMAILS,
  QUEUED_EMAILS,
  TEAM_RULES,
  VENDOR_OPTIONS,
  emailLines,
  invoiceTotal,
  makeEmailSnapshot,
  vendorById,
} from "./seed";
import { detectShape, extractByLabel, normalize, traceValue, type Seen } from "./trace";
import type { CapturedEvent, Email, Episode, FieldRule, MergedRule, Shape, Trace } from "./types";

const T0 = Date.UTC(2026, 9, 1, 15, 0); // fixed clock so the walkthrough is identical every time

export type Session = {
  email: Email;
  lines: string[];
  events: CapturedEvent[];
  fills: { label: string; value: string; shape: Shape; trace?: Trace }[];
};

// variant "shortcut": jumps from the email straight to New Bill and copies the invoice # first,
// so the two tasks differ a little, the way two real runs do.
function recordSession(email: Email, start: number, memo: string, offset: number, variant: "normal" | "shortcut"): Session {
  const inv = email.invoice!;
  const events: CapturedEvent[] = [];
  let t = start;
  let n = offset;
  const push = (e: Omit<CapturedEvent, "id">) => events.push({ id: `sb-${n++}`, ...e });
  const route = `/inbox/${email.id}`;
  const snapshot = makeEmailSnapshot(email);
  const seen: Seen[] = [{ route, snapshot }];

  push({ ts: t, app: "Inbox", route: "/inbox", type: "navigate" });
  push({ ts: (t += 8_000), app: "Inbox", route, type: "navigate" });
  push({ ts: t + 80, app: "Inbox", route, type: "view", label: snapshot.title, snapshot });
  if (variant === "shortcut") {
    push({ ts: (t += 6_000), app: "Inbox", route, type: "copy", value: inv.number, shape: "id" });
    push({ ts: (t += 4_000), app: "Ledgerline", route, type: "click", label: "New Bill" });
  } else {
    push({ ts: (t += 20_000), app: "Ledgerline", route: "/bills", type: "navigate" });
    push({ ts: (t += 14_000), app: "Ledgerline", route: "/bills", type: "click", label: "New Bill" });
  }
  push({ ts: t + 50, app: "Ledgerline", route: "/bills/new", type: "navigate" });

  const values: [string, string][] = [
    ["Vendor", VENDOR_OPTIONS.find((o) => o.startsWith(inv.vendorId))!],
    ["Invoice No.", inv.number],
    ["Invoice Date", isoToMDY(inv.date)],
    ["Due Date", isoToMDY(inv.due)],
    ["Amount", invoiceTotal(inv).toFixed(2)],
    ["GL Account", ACCOUNT_OPTIONS.find((o) => o.startsWith(vendorById(inv.vendorId)!.gl))!],
    ["Memo", memo],
  ];
  const typed: { value: string; shape: Shape }[] = [];
  const fills: Session["fills"] = [];
  values.forEach(([label, value], i) => {
    const shape = detectShape(value, label);
    typed.push({ value, shape });
    const trace = traceValue(value, shape, "/bills/new", seen, typed);
    fills.push({ label, value, shape, trace });
    push({ ts: (t += 12_000 + i * 3_000), app: "Ledgerline", route: "/bills/new", type: "change", label, value, shape, trace });
  });
  push({ ts: (t += 9_000), app: "Ledgerline", route: "/bills/new", type: "submit", label: "Post Bill" });
  return { email, lines: snapshot.lines, events, fills };
}

export type FieldCheck = { field: string; typed: string; auto: string; match: boolean | null };

export type Outcome = {
  email: Email;
  proposal: Proposal;
  status: "Posted" | "Held" | "Blocked";
  flags: string[];
  amount: number;
  protectedAmount: number;
};

export type Sandbox = {
  sessions: Session[];
  episodes: Episode[];
  similarity: number;
  clusters: number;
  personal: FieldRule[];
  merged: MergedRule[];
  dryRun: { episode: Episode; email: Email; checks: FieldCheck[] }[];
  outcomes: Outcome[];
  unfamiliar: {
    email: Email;
    lines: string[];
    missing: string[];
    learned: { field: string; label: string; value: string }[];
    next: { email: Email; filled: string[]; proposal: Proposal };
  };
};

const LAYOUT_KEYS: Record<string, "remitTo" | "number" | "date" | "due" | "total"> = {
  Vendor: "remitTo",
  "Invoice No.": "number",
  "Invoice Date": "date",
  "Due Date": "due",
  Amount: "total",
};
const SHAPES: Record<string, Shape> = { Vendor: "text", "Invoice No.": "id", "Invoice Date": "date", "Due Date": "date", Amount: "currency" };

export function buildSandbox(): Sandbox {
  // 1. Two manual bill entries, recorded the way the in-page recorder would record them.
  const sessions = [
    recordSession(INITIAL_EMAILS[0], T0, "Weekly green coffee", 0, "normal"),
    recordSession(INITIAL_EMAILS[1], T0 + 6 * 60_000, "Dairy delivery", 100, "shortcut"),
  ];
  const events = sessions.flatMap((s) => s.events);

  // 2–4. Split into tasks, group them, learn the rules, merge with the team's.
  const episodes = segment(events);
  const clusters = cluster(episodes);
  const similarity = episodes.length >= 2 ? alignmentSimilarity(episodes[0].tokens, episodes[1].tokens) : 0;
  const personal = clusters[0] ? learnRules(clusters[0]) : [];
  const merged = mergeRules(personal, TEAM_RULES, BILL_FORM_FIELDS);

  // 5. Dry run: replay the merged workflow on the emails that were handled by hand.
  const dryRun = episodes.map((ep) => {
    const email = sessions.find((s) => s.email.id === ep.emailId)?.email ?? sessions[0].email;
    const auto = propose(email, merged);
    const checks = Object.entries(ep.fields).map(([field, f]) => {
      const proposed = auto[field]?.value ?? "";
      const freeText = f.shape === "text" && !f.trace && !/Vendor|GL Account/.test(field);
      return {
        field,
        typed: f.value,
        auto: proposed,
        match: freeText ? null : normalize(proposed, f.shape) === normalize(f.value, f.shape),
      };
    });
    return { episode: ep, email, checks };
  });

  // 6. Three new invoices through the guardrails, checked against the real bill history.
  const pick = (id: string) => QUEUED_EMAILS.find((e) => e.id === id)!;
  const outcomes: Outcome[] = ["eml-102", "eml-101", "eml-106"].map((id) => {
    const email = pick(id);
    const proposal = propose(email, merged);
    const bill = proposalToBill(proposal, email, "Posted", "cl1ck");
    const g = guardrails(bill, email, INITIAL_BILLS);
    return {
      email,
      proposal,
      status: g.block ? "Blocked" : g.hold ? "Held" : "Posted",
      flags: g.flags,
      amount: invoiceTotal(email.invoice!),
      protectedAmount: g.protectedAmount,
    };
  });

  // 8. A layout nobody has seen: the rules miss fields, so it needs one read. The labels that
  // read would return are checked by the free extractor on the vendor's next invoice.
  const first = pick("eml-107");
  const second = pick("eml-108");
  const firstLines = emailLines(first);
  const missing = missingFields(propose(first, merged));
  const learned = REQUIRED_FIELDS.map((field) => {
    const label = first.invoice!.labels?.[LAYOUT_KEYS[field]] ?? field;
    return { field, label, value: extractByLabel(firstLines, label, SHAPES[field]) ?? "" };
  });
  const secondLines = emailLines(second);
  const nextProposal: Proposal = {};
  for (const l of learned) {
    const raw = extractByLabel(secondLines, l.label, SHAPES[l.field]);
    if (raw) nextProposal[l.field] = { value: raw, how: "email", from: l.label, learned: true };
  }

  return {
    sessions,
    episodes,
    similarity,
    clusters: clusters.length,
    personal,
    merged,
    dryRun,
    outcomes,
    unfamiliar: {
      email: first,
      lines: firstLines,
      missing,
      learned,
      next: { email: second, filled: Object.keys(nextProposal), proposal: nextProposal },
    },
  };
}
