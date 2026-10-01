// Workflow runtime: apply learned rules to a new email, check guardrails, write the bill,
// and log every run. Shared by Ledgerline and the dashboard; all state lives in the store.
import { fmtMoney, isoToMDY, mdyToIso, round2, uid } from "./format";
import {
  ACCOUNT_OPTIONS,
  BILL_FORM_FIELDS,
  BILL_WORKFLOW_ID,
  CURRENT_USER,
  DEFAULT_ADOPTION,
  DEFAULT_MODES,
  INITIAL_BILLS,
  INITIAL_EMAILS,
  QUEUED_EMAILS,
  VENDOR_OPTIONS,
  emailLines,
  invoiceTotal,
  makeEmailSnapshot,
  vendorById,
  VENDORS,
} from "./seed";
import { read, update, write } from "./store";
import { detectShape, extractByLabel, formatFor, matchOption, normalize, traceValue, type Seen } from "./trace";
import type { Bill, CapturedEvent, Email, MergedRule, Mode, Run, Shape } from "./types";

export const KEYS = {
  events: "events",
  emails: "emails",
  queue: "queue",
  bills: "bills",
  modes: "modes",
  runs: "runs",
  shares: "shares",
  decision: "decision",
  dismissed: "dismissed",
  settings: "settings",
  seen: "seen",
  adoption: "adoption",
  promoted: "promoted",
  edits: "edits",
  learned: "learned",
} as const;

// Labels learned per vendor after Claude read one of their invoices: vendorId → field → label.
export type LearnedLabels = Record<string, Record<string, string>>;
export const NO_LEARNED: LearnedLabels = {};

// Edits made in plain English (via Claude) on top of the learned rules.
export type RuleEdits = {
  summary?: string;
  vendorHolds: { vendor: string; amount: number }[];
  memoTemplate: string | null;
  notify: { who: string; when: string }[];
};
export const NO_EDITS: RuleEdits = { vendorHolds: [], memoTemplate: null, notify: [] };

export const NO_EVENTS: CapturedEvent[] = [];
export const NO_RUNS: Run[] = [];
export const QUEUE_IDS = QUEUED_EMAILS.map((e) => e.id);
export const NO_SHARES = {} as Record<string, { status: "sent" | "backtesting" | "adopted"; at: number }>;
export const NO_DISMISSED = {} as Record<string, number>;
export const DEFAULT_SETTINGS = { maskValues: false, paused: false };
export const NO_SEEN = {} as Record<string, boolean>;
export const RULE_VERSION = 1;
export const DEFAULT_THRESHOLD = 5000;

export function logEvent(e: CapturedEvent) {
  update<CapturedEvent[]>(KEYS.events, NO_EVENTS, (prev) => [...prev, e].slice(-600));
}

export function getMode(workflowId = BILL_WORKFLOW_ID): Mode {
  return read(KEYS.modes, DEFAULT_MODES)[workflowId] ?? "off";
}

export function setMode(workflowId: string, mode: Mode) {
  update(KEYS.modes, DEFAULT_MODES, (m) => ({ ...m, [workflowId]: mode }));
}

export function threshold() {
  return read<number | null>(KEYS.decision, null) ?? DEFAULT_THRESHOLD;
}

// ---- Proposal: what the workflow would type into the bill form for this email.
export type Proposal = Record<
  string,
  { value: string; how: "email" | "rule" | "constant" | "manual"; from?: string; learned?: boolean }
>;

const OPTIONS: Record<string, string[]> = { Vendor: VENDOR_OPTIONS, "GL Account": ACCOUNT_OPTIONS };

// A bill can't be posted without these. If the rules can't find them, the layout is new.
export const REQUIRED_FIELDS = ["Vendor", "Invoice No.", "Invoice Date", "Due Date", "Amount"];
const FIELD_SHAPES: Record<string, Shape> = {
  Vendor: "text",
  "Invoice No.": "id",
  "Invoice Date": "date",
  "Due Date": "date",
  Amount: "currency",
};

export const missingFields = (p: Proposal) => REQUIRED_FIELDS.filter((f) => !p[f]?.value);

export function vendorForEmail(email: Email) {
  return VENDORS.find((v) => v.email === email.fromEmail) ?? vendorById(email.invoice?.vendorId ?? "");
}

export function propose(email: Email, rules: MergedRule[]): Proposal {
  const lines = emailLines(email);
  const out: Proposal = {};
  const vendor = vendorForEmail(email);
  const learned = (vendor && read(KEYS.learned, NO_LEARNED)[vendor.id]) || {};
  for (const rule of rules) {
    const options = OPTIONS[rule.field];
    if (rule.kind === "extract") {
      const shape = rule.shape === "text" && options ? "text" : rule.shape;
      const tryLabel = (label: string) => {
        const raw = extractByLabel(lines, label, shape);
        if (!raw) return undefined;
        return options ? matchOption(options, raw) : formatFor(rule.shape, raw);
      };
      // This vendor's own labels (learned from one Claude read) come first, then the team's.
      const own = learned[rule.field];
      const fromOwn = own ? tryLabel(own) : undefined;
      if (fromOwn) {
        out[rule.field] = { value: fromOwn, how: "email", from: own, learned: true };
        continue;
      }
      const value = tryLabel(rule.label);
      if (value) out[rule.field] = { value, how: "email", from: rule.label };
    } else if (rule.kind === "lookup") {
      const key = out[rule.by]?.value;
      const value = key ? rule.map[key] : undefined;
      if (value) out[rule.field] = { value, how: "rule", from: rule.by };
    } else if (rule.kind === "constant") {
      out[rule.field] = { value: rule.value, how: "constant" };
    }
  }
  const edits = read<RuleEdits>(KEYS.edits, NO_EDITS);
  if (edits.memoTemplate && email.invoice) {
    const fill: Record<string, string> = {
      invoice_no: email.invoice.number,
      vendor: email.from,
      amount: invoiceTotal(email.invoice).toFixed(2),
      due_date: isoToMDY(email.invoice.due),
    };
    out.Memo = { value: edits.memoTemplate.replace(/\{(\w+)\}/g, (m, k) => fill[k] ?? m), how: "constant" };
  }
  return out;
}

export function proposalToBill(p: Proposal, email: Email, status: Bill["status"], by: string): Bill {
  const vendor = VENDORS.find((v) => p.Vendor?.value.startsWith(v.id)) ?? vendorById(email.invoice?.vendorId ?? "");
  return {
    id: `B-${24100 + Math.floor(Math.random() * 899)}`,
    vendorId: vendor?.id ?? "",
    invoiceNo: p["Invoice No."]?.value ?? "",
    invoiceDate: p["Invoice Date"]?.value ?? "",
    dueDate: p["Due Date"]?.value ?? "",
    amount: Number(p.Amount?.value ?? 0),
    gl: (p["GL Account"]?.value ?? "").split(" ")[0],
    memo: p.Memo?.value ?? "",
    status,
    createdBy: by,
    createdAt: Date.now(),
    emailId: email.id,
  };
}

// ---- Guardrails: block duplicates, hold unusual or large amounts, surface early-pay discounts.
export function guardrails(bill: Bill, email: Email, bills: Bill[]) {
  const flags: string[] = [];
  let block: string | undefined;
  let hold: string | undefined;
  let protectedAmount = 0;

  const dup = bills.find((b) => b.status !== "Voided" && b.vendorId === bill.vendorId && b.invoiceNo === bill.invoiceNo);
  if (dup) {
    block = `Duplicate of ${dup.id} (${fmtMoney(dup.amount)}), not posted`;
    protectedAmount += bill.amount;
  }
  const limit = threshold();
  if (bill.amount > limit) hold = `Over ${fmtMoney(limit).replace(".00", "")}, waiting for approval`;
  const history = bills.filter((b) => b.vendorId === bill.vendorId && b.status === "Posted");
  const avg = history.length ? history.reduce((s, b) => s + b.amount, 0) / history.length : 0;
  if (avg && bill.amount > avg * 3) hold = `${(bill.amount / avg).toFixed(1)}× this vendor's average, paused for review`;
  const edits = read<RuleEdits>(KEYS.edits, NO_EDITS);
  const vendorName = vendorById(bill.vendorId)?.name.toLowerCase() ?? "";
  const vh = edits.vendorHolds.find((h) => vendorName.includes(h.vendor.toLowerCase()) || h.vendor.toLowerCase().includes(vendorName));
  if (vh && bill.amount > vh.amount) hold = `${vendorById(bill.vendorId)?.name} over ${fmtMoney(vh.amount).replace(".00", "")}, waiting for approval`;
  for (const n of edits.notify) flags.push(`Notify ${n.who} (${n.when})`);

  const terms = email.invoice?.terms.match(/(\d+(?:\.\d+)?)\/(\d+)\s+net\s+(\d+)/i);
  if (terms && email.invoice) {
    const pct = Number(terms[1]) / 100;
    const days = Number(terms[2]);
    const [y, m, d] = email.invoice.date.split("-").map(Number);
    const by = new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
    const discount = round2(bill.amount * pct);
    flags.push(`Early-pay discount: pay by ${isoToMDY(by)} to save ${fmtMoney(discount)}`);
    protectedAmount += discount;
  }
  if (block) flags.unshift(block);
  else if (hold) flags.unshift(hold);
  return { flags, block, hold, protectedAmount };
}

// ---- Run the workflow on one email (Ask first / Autopilot).
export function runOnEmail(email: Email, rules: MergedRule[], mode: Mode, manualSeconds: number): Run | undefined {
  if (!email.invoice) return undefined;
  const proposal = propose(email, rules);
  const missing = missingFields(proposal);
  if (!missing.length) return finishRun(email, proposal, mode, manualSeconds);

  // New layout: don't guess. Park it and let Claude read it once (see readWithClaude).
  const run: Run = {
    id: uid("run"),
    ts: Date.now(),
    workflowId: BILL_WORKFLOW_ID,
    emailId: email.id,
    vendor: email.from,
    invoiceNo: "New layout",
    amount: 0,
    status: "Needs read",
    seconds: 0,
    fields: Object.keys(proposal).length,
    flags: [`Unfamiliar layout: couldn't find ${missing.join(", ")}. Asking Claude to read it once.`],
    protected: 0,
    version: RULE_VERSION,
  };
  update<Run[]>(KEYS.runs, NO_RUNS, (prev) => [run, ...prev].slice(0, 100));
  logEvent({
    id: uid("ev"),
    ts: run.ts,
    app: "cl1ck",
    route: "/workflows/bill-from-email",
    type: "automation",
    label: `Unfamiliar invoice from ${email.from}: sending to Claude once`,
  });
  return run;
}

type FinishOptions = { runId?: string; aiCost?: number; learned?: number; aiFlag?: string };

function finishRun(email: Email, proposal: Proposal, mode: Mode, manualSeconds: number, opts: FinishOptions = {}): Run {
  const inv = email.invoice!;
  const bills = read<Bill[]>(KEYS.bills, INITIAL_BILLS);
  const draft = proposalToBill(proposal, email, "Posted", "cl1ck");
  const g = guardrails(draft, email, bills);
  let status: Run["status"] = "Posted";
  if (g.block) status = "Blocked";
  else if (mode === "ask" || g.hold) status = "Awaiting approval";

  const bill: Bill | undefined = g.block
    ? undefined
    : { ...draft, status: status === "Posted" ? "Posted" : "Awaiting approval" };
  if (bill) update<Bill[]>(KEYS.bills, INITIAL_BILLS, (prev) => [bill, ...prev]);
  update<Email[]>(KEYS.emails, INITIAL_EMAILS, (prev) =>
    prev.map((e) => (e.id === email.id ? { ...e, status: "done" } : e)),
  );
  const usedLearned = Object.values(proposal).some((p) => p.learned);
  const aiFlags = opts.aiFlag ? [opts.aiFlag] : usedLearned ? ["Used labels learned from Claude · $0.00"] : [];
  const run: Run = {
    id: opts.runId ?? uid("run"),
    ts: Date.now(),
    workflowId: BILL_WORKFLOW_ID,
    emailId: email.id,
    billId: bill?.id,
    vendor: email.from,
    invoiceNo: proposal["Invoice No."]?.value ?? inv.number,
    amount: Number(proposal.Amount?.value) || invoiceTotal(inv),
    status,
    seconds: status === "Blocked" ? manualSeconds : Math.max(0, manualSeconds - (status === "Posted" ? 0 : 10)),
    fields: Object.keys(proposal).length,
    flags: [...g.flags, ...aiFlags],
    protected: g.protectedAmount,
    version: RULE_VERSION,
    aiCost: opts.aiCost ?? (usedLearned ? 0 : undefined),
    learned: opts.learned,
  };
  update<Run[]>(KEYS.runs, NO_RUNS, (prev) =>
    opts.runId ? prev.map((r) => (r.id === opts.runId ? run : r)) : [run, ...prev].slice(0, 100),
  );
  logEvent({
    id: uid("ev"),
    ts: run.ts,
    app: "cl1ck",
    route: "/workflows/bill-from-email",
    type: "automation",
    label:
      status === "Blocked"
        ? `Blocked ${run.invoiceNo}: ${g.block}`
        : `${status === "Posted" ? "Posted" : "Drafted"} bill ${run.invoiceNo} from ${email.from} (${run.fields} fields${
            opts.aiFlag ? ", read by Claude" : usedLearned ? ", learned labels" : ""
          })`,
  });
  return run;
}

export function fmtCost(dollars: number) {
  return dollars > 0 && dollars < 0.01 ? `$${dollars.toFixed(4)}` : `$${dollars.toFixed(3)}`;
}

type ExtractResponse = {
  fields: Record<string, { value: string; label: string }>;
  usage: { input_tokens: number; output_tokens: number };
  cost: number;
};

// One Claude read for a layout the rules don't know. We only keep a label if the free,
// deterministic extractor reproduces Claude's value with it, so every later email is $0.
export async function readWithClaude(runId: string, rules: MergedRule[], manualSeconds: number): Promise<Run | undefined> {
  const run = read<Run[]>(KEYS.runs, NO_RUNS).find((r) => r.id === runId);
  const email = run && read<Email[]>(KEYS.emails, INITIAL_EMAILS).find((e) => e.id === run.emailId);
  if (!run || !email?.invoice) return undefined;
  const setFlags = (flags: string[]) =>
    update<Run[]>(KEYS.runs, NO_RUNS, (prev) => prev.map((r) => (r.id === runId ? { ...r, flags } : r)));
  setFlags(["Claude is reading this layout once…"]);

  const lines = emailLines(email);
  let data: ExtractResponse;
  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
    data = body as ExtractResponse;
  } catch (err) {
    setFlags([`Claude couldn't read it (${err instanceof Error ? err.message : String(err)}). Left for a person.`]);
    return read<Run[]>(KEYS.runs, NO_RUNS).find((r) => r.id === runId);
  }

  const verified: Record<string, string> = {};
  for (const [field, { value, label }] of Object.entries(data.fields)) {
    const shape = FIELD_SHAPES[field];
    if (!shape || !label || !value) continue;
    const raw = extractByLabel(lines, label, shape);
    if (!raw) continue;
    const ok =
      field === "Vendor"
        ? !!matchOption(VENDOR_OPTIONS, raw) && matchOption(VENDOR_OPTIONS, raw) === matchOption(VENDOR_OPTIONS, value)
        : normalize(raw, shape) === normalize(value, shape);
    if (ok) verified[field] = label;
  }
  const vendor = vendorForEmail(email);
  if (vendor) {
    update<LearnedLabels>(KEYS.learned, NO_LEARNED, (l) => ({ ...l, [vendor.id]: { ...(l[vendor.id] ?? {}), ...verified } }));
  }

  // Re-run the rules (now with this vendor's labels); fill anything still missing from Claude's read.
  const proposal = propose(email, rules);
  for (const f of REQUIRED_FIELDS) {
    const v = data.fields[f]?.value;
    if (proposal[f] || !v) continue;
    const value = OPTIONS[f] ? matchOption(OPTIONS[f], v) : formatFor(FIELD_SHAPES[f], v);
    if (value) proposal[f] = { value, how: "email", from: "Claude" };
  }
  const gl = rules.find((r) => r.field === "GL Account");
  if (!proposal["GL Account"] && gl?.kind === "lookup" && proposal[gl.by]) {
    const value = gl.map[proposal[gl.by].value];
    if (value) proposal["GL Account"] = { value, how: "rule", from: gl.by };
  }
  if (missingFields(proposal).length) {
    setFlags([`Claude read it but ${missingFields(proposal).join(", ")} is still unclear. Left for a person.`]);
    return read<Run[]>(KEYS.runs, NO_RUNS).find((r) => r.id === runId);
  }
  const n = Object.keys(verified).length;
  const mode = getMode() === "ask" ? "ask" : "auto";
  return finishRun(email, proposal, mode, manualSeconds, {
    runId,
    aiCost: data.cost,
    learned: n,
    aiFlag: `Read by Claude once · learned ${n} label${n === 1 ? "" : "s"} · ${fmtCost(data.cost)}`,
  });
}

// Pull the next email from the queue (Send/Receive). Runs the workflow if it's switched on.
export function receiveNextEmail(rules: MergedRule[], manualSeconds: number) {
  const queue = read<string[]>(KEYS.queue, QUEUE_IDS);
  if (!queue.length) return { email: undefined, run: undefined };
  const [id, ...rest] = queue;
  write(KEYS.queue, rest);
  const base = QUEUED_EMAILS.find((e) => e.id === id)!;
  const email: Email = {
    ...base,
    received: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    status: "unread",
  };
  update<Email[]>(KEYS.emails, INITIAL_EMAILS, (prev) => [email, ...prev]);
  const mode = getMode();
  const run = mode === "auto" || mode === "ask" ? runOnEmail(email, rules, mode, manualSeconds) : undefined;
  return { email, run };
}

export function approveRun(runId: string) {
  const run = read<Run[]>(KEYS.runs, NO_RUNS).find((r) => r.id === runId);
  if (!run) return;
  update<Run[]>(KEYS.runs, NO_RUNS, (prev) => prev.map((r) => (r.id === runId ? { ...r, status: "Approved" } : r)));
  update<Bill[]>(KEYS.bills, INITIAL_BILLS, (prev) =>
    prev.map((b) => (b.id === run.billId ? { ...b, status: "Posted" } : b)),
  );
}

export function undoRun(runId: string) {
  const run = read<Run[]>(KEYS.runs, NO_RUNS).find((r) => r.id === runId);
  if (!run) return;
  update<Run[]>(KEYS.runs, NO_RUNS, (prev) => prev.map((r) => (r.id === runId ? { ...r, status: "Undone" } : r)));
  update<Bill[]>(KEYS.bills, INITIAL_BILLS, (prev) =>
    prev.map((b) => (b.id === run.billId ? { ...b, status: "Voided" } : b)),
  );
  update<Email[]>(KEYS.emails, INITIAL_EMAILS, (prev) =>
    prev.map((e) => (e.id === run.emailId ? { ...e, status: "read" } : e)),
  );
}

export function logAssist(email: Email, fields: number, manualSeconds: number) {
  const run: Run = {
    id: uid("run"),
    ts: Date.now(),
    workflowId: BILL_WORKFLOW_ID,
    emailId: email.id,
    vendor: email.from,
    invoiceNo: email.invoice?.number ?? "",
    amount: email.invoice ? invoiceTotal(email.invoice) : 0,
    status: "Assisted",
    seconds: Math.max(0, manualSeconds - 20),
    fields,
    flags: ["Filled in Ledgerline, you posted it"],
    protected: 0,
    version: RULE_VERSION,
  };
  update<Run[]>(KEYS.runs, NO_RUNS, (prev) => [run, ...prev].slice(0, 100));
}

// ---- Readable rule, in the trigger → conditions → actions + guardrails format.
const KEY_NAMES: Record<string, string> = {
  Vendor: "vendor",
  "Invoice No.": "invoice_no",
  "Invoice Date": "invoice_date",
  "Due Date": "due_date",
  Amount: "amount",
  "GL Account": "gl_account",
  Memo: "memo",
};

export function ruleYaml(rules: MergedRule[], mode: Mode, evidence: { yours: number; team: number; dryRun: string }) {
  const fieldLines = rules.map((r) => {
    const key = (KEY_NAMES[r.field] ?? r.field).padEnd(13);
    if (r.kind === "extract") {
      const wrap = r.shape === "date" ? "date" : r.shape === "currency" ? "money" : r.field === "Vendor" ? "match_vendor" : "";
      const src = `email."${r.label}"`;
      return `      ${key}: ${wrap ? `${wrap}(${src})` : src}`;
    }
    if (r.kind === "lookup") return `      ${key}: lookup(${KEY_NAMES[r.by] ?? r.by})   # ${Object.keys(r.map).length} vendors learned`;
    if (r.kind === "constant") return `      ${key}: "${r.value}"`;
    return `      ${key}: ask_user`;
  });
  const modeName = mode === "auto" ? "act" : mode === "ask" ? "notify_only" : mode;
  return [
    "name: Enter bill from emailed invoice",
    "trigger: inbox.email_received",
    "conditions:",
    "  - has_invoice: true",
    "  - from_known_vendor: true",
    "actions:",
    "  - create: ledgerline.bill",
    "    fields:",
    ...fieldLines,
    "  - post: ledgerline.bill",
    "  - mark_done: inbox.email",
    "guardrails:",
    `  mode: ${modeName}`,
    `  max_amount: ${threshold()}        # above this, wait for approval`,
    ...read<RuleEdits>(KEYS.edits, NO_EDITS).vendorHolds.map((h) => `  hold_vendor: { vendor: "${h.vendor}", over: ${h.amount} }`),
    ...read<RuleEdits>(KEYS.edits, NO_EDITS).notify.map((n) => `  notify: { who: "${n.who}", when: "${n.when}" }`),
    "  block_on: [duplicate_invoice]",
    "  pause_on: [amount_over_3x_vendor_average, vendor_bank_change]",
    "  permissions: capped_to_owner",
    "evidence:",
    `  your_runs: ${evidence.yours}`,
    `  team_runs: ${evidence.team}`,
    `  dry_run: "${evidence.dryRun}"`,
    `  version: ${RULE_VERSION}`,
  ].join("\n");
}

// ---- Sample session: two realistic manual runs pushed through the real tracer and miner,
// for when you want the dashboard populated without typing.
export function loadSampleSession() {
  const now = Date.now();
  const plan: { email: Email; start: number; memo: string; gaps: number[] }[] = [
    { email: INITIAL_EMAILS[0], start: now - 11 * 60_000, memo: "Weekly green coffee", gaps: [9, 21, 16, 14, 33, 18, 25, 22] },
    { email: INITIAL_EMAILS[1], start: now - 6 * 60_000, memo: "Dairy delivery", gaps: [7, 18, 15, 12, 29, 16, 21, 19] },
  ];
  const events: CapturedEvent[] = [];
  const newBills: Bill[] = [];
  for (const { email, start, memo, gaps } of plan) {
    let t = start;
    const step = (i: number) => (t += gaps[i % gaps.length] * 1000);
    const push = (e: Omit<CapturedEvent, "id">) => events.push({ id: uid("ev"), ...e });
    const route = `/inbox/${email.id}`;
    const snapshot = makeEmailSnapshot(email);
    const seen: Seen[] = [{ route, snapshot }];
    push({ ts: t, app: "Inbox", route: "/inbox", type: "navigate" });
    push({ ts: step(0), app: "Inbox", route, type: "navigate" });
    push({ ts: t + 80, app: "Inbox", route, type: "view", label: snapshot.title, snapshot });
    push({ ts: step(1), app: "Ledgerline", route: "/bills", type: "navigate" });
    push({ ts: step(2), app: "Ledgerline", route: "/bills", type: "click", label: "New Bill" });
    push({ ts: t + 50, app: "Ledgerline", route: "/bills/new", type: "navigate" });
    const inv = email.invoice!;
    const vendor = VENDOR_OPTIONS.find((o) => o.startsWith(inv.vendorId))!;
    const gl = ACCOUNT_OPTIONS.find((o) => o.startsWith(vendorById(inv.vendorId)!.gl))!;
    const values: [string, string][] = [
      ["Vendor", vendor],
      ["Invoice No.", inv.number],
      ["Invoice Date", isoToMDY(inv.date)],
      ["Due Date", isoToMDY(inv.due)],
      ["Amount", invoiceTotal(inv).toFixed(2)],
      ["GL Account", gl],
      ["Memo", memo],
    ];
    const typed: { value: string; shape: Shape }[] = [];
    values.forEach(([label, value], i) => {
      const shape = detectShape(value, label);
      typed.push({ value, shape });
      push({
        ts: step(i + 3),
        app: "Ledgerline",
        route: "/bills/new",
        type: "change",
        label,
        value,
        shape,
        trace: traceValue(value, shape, "/bills/new", seen, typed),
      });
    });
    push({ ts: step(7), app: "Ledgerline", route: "/bills/new", type: "submit", label: "Post Bill" });
    newBills.push({
      id: `B-${24090 + newBills.length}`,
      vendorId: inv.vendorId,
      invoiceNo: inv.number,
      invoiceDate: isoToMDY(inv.date),
      dueDate: isoToMDY(inv.due),
      amount: invoiceTotal(inv),
      gl: vendorById(inv.vendorId)!.gl,
      memo,
      status: "Posted",
      createdBy: CURRENT_USER,
      createdAt: t,
      emailId: email.id,
    });
  }
  update<CapturedEvent[]>(KEYS.events, NO_EVENTS, (prev) => [...prev, ...events].sort((a, b) => a.ts - b.ts));
  update<Bill[]>(KEYS.bills, INITIAL_BILLS, (prev) => [...newBills.reverse(), ...prev]);
  update<Email[]>(KEYS.emails, INITIAL_EMAILS, (prev) =>
    prev.map((e) => (plan.some((p) => p.email.id === e.id) ? { ...e, status: "done" } : e)),
  );
}

export function validDate(v: string) {
  return !!mdyToIso(v);
}

export { BILL_FORM_FIELDS };

// ---- Group actions: turn a workflow on for a whole group, promote a personal setup, share.
export const NO_PROMOTED = {} as Record<string, boolean>;

export function turnOnFor(workflowId: string, groupId: string, mode: Mode = "auto") {
  update(KEYS.adoption, DEFAULT_ADOPTION, (a) => ({
    ...a,
    [workflowId]: Array.from(new Set([...(a[workflowId] ?? []), groupId])),
  }));
  if (workflowId === BILL_WORKFLOW_ID) setMode(workflowId, mode);
}

export function turnOffFor(workflowId: string, groupId: string) {
  update(KEYS.adoption, DEFAULT_ADOPTION, (a) => ({
    ...a,
    [workflowId]: (a[workflowId] ?? []).filter((g) => g !== groupId),
  }));
}

export function promoteSetup(memberId: string) {
  update(KEYS.promoted, NO_PROMOTED, (p) => ({ ...p, [memberId]: true }));
}

export function shareWith(groupId: string) {
  update(KEYS.shares, NO_SHARES, (s) => ({ ...s, [groupId]: { status: "sent" as const, at: Date.now() } }));
  window.setTimeout(
    () => update(KEYS.shares, NO_SHARES, (s) => ({ ...s, [groupId]: { status: "backtesting" as const, at: Date.now() } })),
    900,
  );
  window.setTimeout(() => {
    update(KEYS.shares, NO_SHARES, (s) => ({ ...s, [groupId]: { status: "adopted" as const, at: Date.now() } }));
    update(KEYS.adoption, DEFAULT_ADOPTION, (a) => ({
      ...a,
      [BILL_WORKFLOW_ID]: Array.from(new Set([...(a[BILL_WORKFLOW_ID] ?? []), groupId])),
    }));
  }, 2600);
}

export function dismissSuggestion(workflowId: string) {
  update(KEYS.dismissed, NO_DISMISSED, (d) => ({ ...d, [workflowId]: (d[workflowId] ?? 0) + 1 }));
}
