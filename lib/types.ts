export type Shape = "currency" | "date" | "id" | "email" | "text";

export type Token = { raw: string; norm: string; shape: Shape; line: number; index: number };

// What was on screen when the user viewed a page: plain text lines plus typed values found in them.
export type Snapshot = { title: string; lines: string[]; tokens: Token[] };

// Where a typed value was seen before it was typed.
export type Trace = { route: string; title: string; label: string };

export type EventType =
  | "navigate"
  | "view"
  | "click"
  | "change"
  | "copy"
  | "paste"
  | "submit"
  | "submit_failed"
  | "automation";

export type CapturedEvent = {
  id: string;
  ts: number;
  app: string;
  route: string;
  type: EventType;
  label?: string;
  value?: string;
  from?: string; // previous value, for edits
  shape?: Shape;
  snapshot?: Snapshot;
  trace?: Trace;
};

export type Vendor = { id: string; name: string; email: string; gl: string; address: string };
export type Account = { code: string; name: string };

export type InvoiceLine = { desc: string; qty: number; unit: number };
// Some vendors print the same fields under different labels ("Document No." vs "Invoice #").
export type InvoiceLabels = Partial<
  Record<"title" | "remitTo" | "number" | "date" | "due" | "terms" | "billTo" | "total", string>
>;

export type Invoice = {
  number: string;
  vendorId: string;
  date: string; // ISO yyyy-mm-dd
  due: string;
  terms: string;
  lines: InvoiceLine[];
  labels?: InvoiceLabels;
};

export type Email = {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  received: string; // display label, e.g. "Wed 9:14 AM"
  body: string;
  invoice?: Invoice;
  status: "unread" | "read" | "done";
};

export type BillStatus = "Posted" | "Awaiting approval" | "Voided";

export type Bill = {
  id: string;
  vendorId: string;
  invoiceNo: string;
  invoiceDate: string; // MM/DD/YYYY, the way Ledgerline wants it
  dueDate: string;
  amount: number;
  gl: string;
  memo: string;
  status: BillStatus;
  createdBy: string;
  createdAt: number;
  emailId?: string;
};

export type Mode = "off" | "suggest" | "ask" | "auto";

export type RunStatus =
  | "Posted"
  | "Awaiting approval"
  | "Approved"
  | "Assisted"
  | "Blocked"
  | "Needs read"
  | "Undone";

export type Run = {
  id: string;
  ts: number;
  workflowId: string;
  emailId: string;
  billId?: string;
  vendor: string;
  invoiceNo: string;
  amount: number;
  status: RunStatus;
  seconds: number; // manual time this run replaced
  fields: number;
  flags: string[]; // guardrail notes shown on the run
  protected: number; // dollars kept from going out the door (duplicates caught, discounts found)
  version: number; // rule version that ran, for the audit log
  aiCost?: number; // dollars spent on Claude for this run (only when a new layout had to be read)
  learned?: number; // labels learned from that read
};

export type FieldRule =
  | { field: string; kind: "extract"; label: string; shape: Shape; support: number; total: number }
  | { field: string; kind: "lookup"; by: string; map: Record<string, string>; support: number; total: number }
  | { field: string; kind: "constant"; value: string; support: number; total: number }
  | { field: string; kind: "manual"; support: number; total: number };

export type RuleSource = "you" | "team" | "both";
export type MergedRule = FieldRule & { source: RuleSource; teamSupport?: number; teamTotal?: number };

export type Episode = {
  id: string;
  start: number;
  end: number;
  seconds: number;
  form: string;
  emailId?: string;
  sourceTitle?: string;
  fields: Record<string, { value: string; from?: string; shape: Shape; trace?: Trace }>;
  order: string[];
  tokens: string[];
  copies: number;
  pastes: number;
};

export type Cluster = { id: string; form: string; episodes: Episode[]; fieldLabels: string[] };

export type ShareStatus = { status: "sent" | "backtesting" | "adopted"; at: number };
