// Hardcoded demo world: Juniper Coffee Roasters, its vendors, inbox, bills, and the
// team-level history that cl1ck has already learned from.
import { fmtMoney, isoToLong, round2 } from "./format";
import { makeSnapshot } from "./trace";
import type { Account, Bill, Email, FieldRule, Invoice, Mode, Vendor } from "./types";

export const COMPANY = "Juniper Coffee Roasters";
export const CURRENT_USER = "dana.k";

export const VENDORS: Vendor[] = [
  { id: "V-1004", name: "Acme Roasting Supply", email: "billing@acmeroasting.example", gl: "5100", address: "88 Foundry Ave, Oakland CA" },
  { id: "V-1011", name: "Highland Green Coffee Imports", email: "ar@highlandgreen.example", gl: "5100", address: "1200 Harbor Way, Long Beach CA" },
  { id: "V-1019", name: "Northfield Dairy Co.", email: "invoices@northfielddairy.example", gl: "5200", address: "41 Creamery Rd, Petaluma CA" },
  { id: "V-1023", name: "PackRight Packaging", email: "billing@packright.example", gl: "5300", address: "9 Industrial Pkwy, Fremont CA" },
  { id: "V-1030", name: "CloudLedger Hosting", email: "billing@cloudledger.example", gl: "6100", address: "500 Market St, San Francisco CA" },
  { id: "V-1036", name: "Metro Power & Light", email: "accounts@metropower.example", gl: "6300", address: "PO Box 7700, Oakland CA" },
  { id: "V-1042", name: "Sunrise Facilities Services", email: "ar@sunrisefacilities.example", gl: "6400", address: "17 Mission Blvd, Hayward CA" },
  { id: "V-1047", name: "Bean Freight Logistics", email: "billing@beanfreight.example", gl: "5400", address: "3 Terminal Dr, Oakland CA" },
  { id: "V-1052", name: "Golden Gate Brew Equipment", email: "accounts@ggbrewequip.example", gl: "6400", address: "71 Embarcadero Rd, Palo Alto CA" },
];

export const ACCOUNTS: Account[] = [
  { code: "5100", name: "Green Coffee Beans" },
  { code: "5200", name: "Dairy & Milk Alternatives" },
  { code: "5300", name: "Packaging Supplies" },
  { code: "5400", name: "Freight In" },
  { code: "6100", name: "Software & Hosting" },
  { code: "6300", name: "Power" },
  { code: "6400", name: "Repairs & Maintenance" },
  { code: "6900", name: "Miscellaneous Expense" },
];

export const vendorOption = (v: Vendor) => `${v.id} · ${v.name}`;
export const accountOption = (a: Account) => `${a.code} · ${a.name}`;
export const VENDOR_OPTIONS = VENDORS.map(vendorOption);
export const ACCOUNT_OPTIONS = ACCOUNTS.map(accountOption);

export const vendorById = (id: string) => VENDORS.find((v) => v.id === id);
export const accountByCode = (code: string) => ACCOUNTS.find((a) => a.code === code);

export function invoiceTotal(inv: Invoice) {
  return round2(inv.lines.reduce((sum, l) => sum + l.qty * l.unit, 0));
}

function invoiceEmail(
  id: string,
  vendorId: string,
  received: string,
  inv: Omit<Invoice, "vendorId">,
  body: string,
): Email {
  const v = vendorById(vendorId)!;
  return {
    id,
    from: v.name,
    fromEmail: v.email,
    subject: `Invoice ${inv.number} from ${v.name}`,
    received,
    body,
    invoice: { ...inv, vendorId },
    status: "unread",
  };
}

export const INITIAL_EMAILS: Email[] = [
  invoiceEmail(
    "eml-001",
    "V-1004",
    "Wed 8:02 AM",
    {
      number: "INV-4471",
      date: "2026-09-28",
      due: "2026-10-28",
      terms: "Net 30",
      lines: [
        { desc: "Colombia Supremo green beans, lb", qty: 150, unit: 6.4 },
        { desc: "Ethiopia Yirgacheffe green beans, lb", qty: 100, unit: 8.75 },
      ],
    },
    "Hi Juniper team, please find this week's invoice attached. Thanks for your business!",
  ),
  invoiceEmail(
    "eml-002",
    "V-1019",
    "Wed 8:47 AM",
    {
      number: "NFD-20931",
      date: "2026-09-29",
      due: "2026-10-14",
      terms: "Net 15",
      lines: [
        { desc: "Whole milk, gallon", qty: 40, unit: 4.85 },
        { desc: "Oat milk, carton", qty: 24, unit: 3.9 },
      ],
    },
    "Attached is the invoice for the September 29 delivery.",
  ),
  {
    id: "eml-003",
    from: "Maria Ortiz",
    fromEmail: "maria@juniper.example",
    subject: "Friday team lunch",
    received: "Wed 9:03 AM",
    body: "Lunch is on Friday at noon in the roastery. Reply with any dietary needs!",
    status: "unread",
  },
  invoiceEmail(
    "eml-004",
    "V-1030",
    "Wed 9:20 AM",
    {
      number: "CL-88213",
      date: "2026-09-30",
      due: "2026-10-30",
      terms: "Net 30",
      lines: [
        { desc: "POS cloud plan, October", qty: 1, unit: 249 },
        { desc: "Online store add-on, October", qty: 1, unit: 79 },
      ],
    },
    "Your October invoice is ready.",
  ),
  invoiceEmail(
    "eml-005",
    "V-1023",
    "Wed 9:41 AM",
    {
      number: "PR-5520",
      date: "2026-09-30",
      due: "2026-10-30",
      terms: "Net 30",
      lines: [
        { desc: "12 oz retail bags, each", qty: 2000, unit: 0.42 },
        { desc: "Printed labels, each", qty: 2000, unit: 0.06 },
      ],
    },
    "Invoice attached for PO 7731. Let us know if anything looks off.",
  ),
];

const NEW_LAYOUT: Invoice["labels"] = {
  title: "TAX INVOICE",
  remitTo: "Remit to",
  number: "Document No.",
  date: "Issued",
  due: "Payment due by",
  terms: "Payment terms",
  billTo: "Customer",
  total: "Amount payable",
};

// Arrive one at a time when someone clicks Send/Receive.
export const QUEUED_EMAILS: Email[] = [
  invoiceEmail(
    "eml-101",
    "V-1011",
    "",
    {
      number: "HG-10388",
      date: "2026-09-30",
      due: "2026-10-30",
      terms: "2/10 Net 30",
      lines: [
        { desc: "Guatemala Huehuetenango green beans, lb", qty: 600, unit: 7.2 },
        { desc: "Kenya AA green beans, lb", qty: 300, unit: 9.1 },
      ],
    },
    "Container shipment invoice attached.",
  ),
  invoiceEmail(
    "eml-102",
    "V-1036",
    "",
    {
      number: "MPL-552019",
      date: "2026-10-01",
      due: "2026-10-21",
      terms: "Net 20",
      lines: [{ desc: "Electric service, September 2026", qty: 1, unit: 612.45 }],
    },
    "Your monthly statement is attached.",
  ),
  invoiceEmail(
    "eml-106",
    "V-1004",
    "",
    {
      number: "INV-4433",
      date: "2026-09-21",
      due: "2026-10-21",
      terms: "Net 30",
      lines: [
        { desc: "Colombia Supremo green beans, lb", qty: 150, unit: 6.4 },
        { desc: "Brazil Cerrado green beans, lb", qty: 88, unit: 6 },
      ],
    },
    "Resending this one in case it got lost. Thanks!",
  ),
  invoiceEmail(
    "eml-103",
    "V-1047",
    "",
    {
      number: "BF-7781",
      date: "2026-10-01",
      due: "2026-10-31",
      terms: "Net 30",
      lines: [
        { desc: "LTL freight, Port of Oakland to roastery", qty: 1, unit: 385 },
        { desc: "Fuel surcharge", qty: 1, unit: 46.2 },
      ],
    },
    "Invoice for the 9/30 delivery attached.",
  ),
  invoiceEmail(
    "eml-104",
    "V-1004",
    "",
    {
      number: "INV-4502",
      date: "2026-10-01",
      due: "2026-10-31",
      terms: "Net 30",
      lines: [{ desc: "Brazil Cerrado green beans, lb", qty: 200, unit: 5.9 }],
    },
    "Thanks again! Invoice attached.",
  ),
  invoiceEmail(
    "eml-105",
    "V-1042",
    "",
    {
      number: "SF-3307",
      date: "2026-10-01",
      due: "2026-10-16",
      terms: "Net 15",
      lines: [
        { desc: "Espresso machine service call", qty: 1, unit: 480 },
        { desc: "Group head gasket", qty: 2, unit: 22.5 },
      ],
    },
    "Invoice for yesterday's service visit.",
  ),
  // A vendor nobody on the team has seen: same fields, different labels. Claude reads the
  // first one; cl1ck learns the labels so the second one costs nothing.
  {
    ...invoiceEmail(
      "eml-107",
      "V-1052",
      "",
      {
        number: "GGB-2207",
        date: "2026-10-01",
        due: "2026-10-31",
        terms: "30 days from issue",
        labels: NEW_LAYOUT,
        lines: [
          { desc: "Grinder burr set, commercial", qty: 2, unit: 640 },
          { desc: "Espresso machine descaling kit", qty: 4, unit: 85 },
          { desc: "Steam wand rebuild, labor", qty: 1, unit: 720 },
        ],
      },
      "Please remit payment for the attached document. Welcome aboard as a new customer!",
    ),
    subject: "Document GGB-2207 – Golden Gate Brew Equipment",
  },
  {
    ...invoiceEmail(
      "eml-108",
      "V-1052",
      "",
      {
        number: "GGB-2231",
        date: "2026-10-01",
        due: "2026-10-31",
        terms: "30 days from issue",
        labels: NEW_LAYOUT,
        lines: [
          { desc: "Portafilter baskets, 18g", qty: 12, unit: 24.5 },
          { desc: "Gasket and screen kit", qty: 6, unit: 48.75 },
          { desc: "Preventive maintenance visit", qty: 1, unit: 600 },
        ],
      },
      "Second document for this month's maintenance. Thank you!",
    ),
    subject: "Document GGB-2231 – Golden Gate Brew Equipment",
  },
];

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 8, 30, 17, 0);

export const INITIAL_BILLS: Bill[] = [
  ["B-24081", "V-1004", "INV-4398", "09/14/2026", "10/14/2026", 1622.5, "5100", "Weekly green coffee", 16],
  ["B-24082", "V-1019", "NFD-20877", "09/15/2026", "09/30/2026", 301.2, "5200", "Dairy delivery", 15],
  ["B-24083", "V-1036", "MPL-549870", "09/02/2026", "09/22/2026", 588.1, "6300", "Electric, August", 14],
  ["B-24084", "V-1023", "PR-5491", "09/16/2026", "10/16/2026", 744, "5300", "Bags and labels", 12],
  ["B-24085", "V-1047", "BF-7702", "09/18/2026", "10/18/2026", 412.75, "5400", "Inbound freight", 10],
  ["B-24086", "V-1030", "CL-87990", "09/01/2026", "10/01/2026", 328, "6100", "September plan", 9],
  ["B-24087", "V-1011", "HG-10311", "09/21/2026", "10/21/2026", 6890, "5100", "Container, Sept", 6],
  ["B-24088", "V-1004", "INV-4433", "09/21/2026", "10/21/2026", 1488, "5100", "Weekly green coffee", 5],
].map(([id, vendorId, invoiceNo, invoiceDate, dueDate, amount, gl, memo, daysAgo]) => ({
  id: id as string,
  vendorId: vendorId as string,
  invoiceNo: invoiceNo as string,
  invoiceDate: invoiceDate as string,
  dueDate: dueDate as string,
  amount: amount as number,
  gl: gl as string,
  memo: memo as string,
  status: "Posted" as const,
  createdBy: "sam.r",
  createdAt: T0 - (daysAgo as number) * DAY,
}));

// ---- The invoice document, as plain lines. The email view renders exactly these lines,
// so the recorder's screen snapshot and the automation's extractor see the same text.
export type DocBlock =
  | { kind: "kv"; label: string; value: string }
  | { kind: "text"; text: string }
  | { kind: "letterhead"; name: string; address: string }
  | { kind: "title"; text: string }
  | { kind: "row"; cells: string[]; header?: boolean }
  | { kind: "total"; label: string; value: string };

export function emailHeaderBlocks(email: Email): DocBlock[] {
  return [
    { kind: "kv", label: "From", value: `${email.from} <${email.fromEmail}>` },
    { kind: "kv", label: "Subject", value: email.subject },
    { kind: "kv", label: "Received", value: email.received || "Just now" },
    { kind: "text", text: email.body },
  ];
}

export function invoiceBlocks(email: Email): DocBlock[] {
  const inv = email.invoice;
  if (!inv) return [];
  const v = vendorById(inv.vendorId)!;
  const L = inv.labels ?? {};
  return [
    { kind: "letterhead", name: v.name, address: v.address },
    { kind: "title", text: L.title ?? "INVOICE" },
    ...(L.remitTo ? [{ kind: "kv" as const, label: L.remitTo, value: `${v.name}, ${v.address}` }] : []),
    { kind: "kv", label: L.number ?? "Invoice #", value: inv.number },
    { kind: "kv", label: L.date ?? "Invoice date", value: isoToLong(inv.date) },
    { kind: "kv", label: L.due ?? "Due date", value: isoToLong(inv.due) },
    { kind: "kv", label: L.terms ?? "Terms", value: inv.terms },
    { kind: "kv", label: L.billTo ?? "Bill to", value: `${COMPANY}, 220 Alameda St, Oakland CA` },
    { kind: "row", header: true, cells: ["Description", "Qty", "Unit price", "Amount"] },
    ...inv.lines.map((l) => ({
      kind: "row" as const,
      cells: [l.desc, String(l.qty), fmtMoney(l.unit), fmtMoney(round2(l.qty * l.unit))],
    })),
    { kind: "total", label: L.total ?? "Total due", value: fmtMoney(invoiceTotal(inv)) },
  ];
}

export function blockLines(blocks: DocBlock[]): string[] {
  return blocks.flatMap((b) => {
    switch (b.kind) {
      case "kv":
        return [`${b.label}: ${b.value}`];
      case "text":
        return [b.text];
      case "letterhead":
        return [b.name, b.address];
      case "title":
        return [b.text];
      case "row":
        return [b.cells.join(" ")];
      case "total":
        return [`${b.label} ${b.value}`];
    }
  });
}

export const emailLines = (email: Email) => [
  email.subject,
  ...blockLines(emailHeaderBlocks(email)),
  ...blockLines(invoiceBlocks(email)),
];

export const makeEmailSnapshot = (email: Email) => makeSnapshot(email.subject, emailLines(email));

// ---- What the team layer already learned from Accounts Payable's history (212 runs).
export const BILL_FORM_FIELDS = ["Vendor", "Invoice No.", "Invoice Date", "Due Date", "Amount", "GL Account", "Memo"];

export const TEAM_RULES: FieldRule[] = [
  { field: "Vendor", kind: "extract", label: "From", shape: "text", support: 212, total: 212 },
  { field: "Invoice No.", kind: "extract", label: "Invoice #", shape: "id", support: 212, total: 212 },
  { field: "Invoice Date", kind: "extract", label: "Invoice date", shape: "date", support: 211, total: 212 },
  { field: "Due Date", kind: "extract", label: "Due date", shape: "date", support: 205, total: 212 },
  { field: "Amount", kind: "extract", label: "Total due", shape: "currency", support: 212, total: 212 },
  {
    field: "GL Account",
    kind: "lookup",
    by: "Vendor",
    map: Object.fromEntries(VENDORS.map((v) => [vendorOption(v), accountOption(ACCOUNTS.find((a) => a.code === v.gl)!)])),
    support: 209,
    total: 212,
  },
  { field: "Memo", kind: "extract", label: "Subject", shape: "text", support: 140, total: 212 },
];

export const BILL_WORKFLOW_ID = "bill-from-email";

export const DEFAULT_MODES: Record<string, Mode> = {
  [BILL_WORKFLOW_ID]: "suggest",
  "categorize-card": "off",
  "chase-overdue": "off",
};

export const TEAM_SAMPLE_RUNS = [
  {
    who: "Teammate · Mon",
    seconds: 262,
    values: ["Acme Roasting Supply", "INV-4433", "09/21/2026", "10/21/2026", "1,488.00", "5100", "Weekly green coffee"],
  },
  {
    who: "Teammate · Tue",
    seconds: 241,
    values: ["Highland Green Coffee", "HG-10311", "09/21/2026", "10/21/2026", "6,890.00", "5100", "Container, Sept"],
  },
  {
    who: "Teammate · Tue",
    seconds: 98,
    values: ["PackRight Packaging", "PR-5491", "09/16/2026", "10/16/2026", "744.00", "5300", "Bags and labels"],
  },
];

// ---- Layers. Each layer only sees pattern templates from the layer below it.
export type LayerId = "me" | "ap" | "finance" | "org";

export type PatternSummary = {
  id: string;
  name: string;
  apps: string[];
  runsPerWeek: number;
  medianSeconds: number;
  people?: string; // "4 of 4 people"
  teams?: string[];
  status: "suggested" | "detected" | "forming" | "automated";
  progress?: [number, number];
  note?: string;
};

export const LAYERS: { id: LayerId; name: string; kind: string; people: number }[] = [
  { id: "org", name: COMPANY, kind: "Organization", people: 33 },
  { id: "finance", name: "Finance", kind: "Department", people: 7 },
  { id: "ap", name: "Accounts Payable", kind: "Team", people: 4 },
  { id: "me", name: "Me", kind: "Personal", people: 1 },
];

export const TEAM_PATTERNS: PatternSummary[] = [
  {
    id: BILL_WORKFLOW_ID,
    name: "Enter bill from emailed invoice",
    apps: ["Inbox", "Ledgerline"],
    runsPerWeek: 60,
    medianSeconds: 250,
    people: "4 of 4 people",
    status: "suggested",
    note: "Variant B is 2m 40s faster",
  },
  {
    id: "categorize-card",
    name: "Categorize card transactions",
    apps: ["Ledgerline"],
    runsPerWeek: 140,
    medianSeconds: 25,
    people: "3 of 4 people",
    status: "suggested",
  },
  {
    id: "chase-overdue",
    name: "Chase overdue invoices",
    apps: ["Ledgerline", "Inbox"],
    runsPerWeek: 18,
    medianSeconds: 360,
    people: "2 of 4 people",
    status: "suggested",
  },
  {
    id: "match-bank",
    name: "Match bank feed to bills",
    apps: ["Ledgerline"],
    runsPerWeek: 40,
    medianSeconds: 45,
    people: "2 of 4 people",
    status: "forming",
    progress: [2, 3],
    note: "Needs 1 more person before the team sees it",
  },
];

export const FINANCE_PATTERNS: PatternSummary[] = [
  { id: "categorize-card", name: "Categorize card transactions", apps: ["Ledgerline"], runsPerWeek: 190, medianSeconds: 25, teams: ["AP", "FP&A"], status: "suggested" },
  { id: BILL_WORKFLOW_ID, name: "Enter bill from emailed invoice", apps: ["Inbox", "Ledgerline"], runsPerWeek: 60, medianSeconds: 250, teams: ["AP"], status: "suggested" },
  { id: "chase-overdue", name: "Chase overdue invoices", apps: ["Ledgerline", "Inbox"], runsPerWeek: 30, medianSeconds: 360, teams: ["AR", "AP"], status: "suggested" },
  { id: "bank-statements", name: "Download bank statements", apps: ["Bank portal", "Ledgerline"], runsPerWeek: 10, medianSeconds: 180, teams: ["AP", "AR"], status: "suggested" },
  { id: "accrual-je", name: "Month-end accrual entries", apps: ["Sheets", "Ledgerline"], runsPerWeek: 6, medianSeconds: 900, teams: ["FP&A"], status: "forming", progress: [1, 3] },
];

export const ORG_PATTERNS: PatternSummary[] = [
  { id: "categorize-card", name: "Categorize card transactions", apps: ["Ledgerline"], runsPerWeek: 260, medianSeconds: 25, teams: ["Finance", "Operations", "Engineering"], status: "suggested" },
  { id: "approve-po", name: "Approve purchase requests", apps: ["Slack", "Ledgerline"], runsPerWeek: 45, medianSeconds: 120, teams: ["Operations", "Finance"], status: "suggested" },
  { id: BILL_WORKFLOW_ID, name: "Enter bill from emailed invoice", apps: ["Inbox", "Ledgerline"], runsPerWeek: 60, medianSeconds: 250, teams: ["Finance"], status: "suggested" },
  { id: "kpi-report", name: "Weekly KPI report", apps: ["Sheets", "Slack"], runsPerWeek: 3, medianSeconds: 1800, teams: ["Finance", "Operations"], status: "suggested" },
  { id: "after-interview", name: "After-interview follow-up", apps: ["ATS", "Gmail", "Calendar"], runsPerWeek: 180, medianSeconds: 240, teams: ["Recruiting"], status: "suggested" },
  { id: "ticket-to-merge", name: "Ticket → branch → PR → deploy note", apps: ["Linear", "Terminal", "GitHub"], runsPerWeek: 60, medianSeconds: 180, teams: ["Engineering"], status: "suggested" },
  { id: "after-call", name: "After-call CRM logging", apps: ["CRM", "Gmail"], runsPerWeek: 120, medianSeconds: 300, teams: ["Sales"], status: "suggested" },
  { id: "ticket-triage", name: "Support ticket triage", apps: ["Helpdesk", "Admin", "Billing"], runsPerWeek: 300, medianSeconds: 90, teams: ["Support"], status: "suggested" },
];

// ---- Org tree. Sharing is limited to one gap: parent, children, or siblings.
export type OrgNode = { id: string; name: string; people?: number; children?: OrgNode[] };

export const ORG_TREE: OrgNode = {
  id: "org",
  name: COMPANY,
  children: [
    {
      id: "finance",
      name: "Finance",
      children: [
        { id: "ap", name: "Accounts Payable", people: 4 },
        { id: "ar", name: "Accounts Receivable", people: 2 },
        { id: "fpa", name: "FP&A", people: 1 },
      ],
    },
    {
      id: "ops",
      name: "Operations",
      children: [
        { id: "purchasing", name: "Purchasing", people: 2 },
        { id: "warehouse", name: "Warehouse", people: 3 },
      ],
    },
    { id: "eng", name: "Engineering", children: [{ id: "platform", name: "Platform", people: 4 }] },
    { id: "people", name: "People", children: [{ id: "recruiting", name: "Recruiting", people: 3 }] },
    {
      id: "gtm",
      name: "Go-to-market",
      children: [
        { id: "sales", name: "Sales", people: 4 },
        { id: "support", name: "Support", people: 3 },
      ],
    },
  ],
};

export const MY_TEAM = "ap";

function parentOf(id: string, node: OrgNode = ORG_TREE, parent: OrgNode | null = null): OrgNode | null | undefined {
  if (node.id === id) return parent;
  for (const child of node.children ?? []) {
    const found = parentOf(id, child, node);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function findNode(id: string, node: OrgNode = ORG_TREE): OrgNode | undefined {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNode(id, child);
    if (found) return found;
  }
  return undefined;
}

export function relation(from: string, to: string): "up" | "down" | "beside" | null {
  if (from === to) return null;
  const pFrom = parentOf(from);
  const pTo = parentOf(to);
  if (pFrom?.id === to) return "up";
  if (pTo?.id === from) return "down";
  if (pFrom && pTo && pFrom.id === pTo.id) return "beside";
  return null;
}

export const SHARE_BACKTESTS: Record<string, { matched: number; total: number } | null> = {
  finance: null,
  ar: { matched: 18, total: 20 },
  fpa: { matched: 3, total: 3 },
};

// ---- People on Accounts Payable. Names are shown because each person opted in to credit.
export type Member = {
  id: string;
  name: string;
  initials: string;
  you?: boolean;
  billRunsPerWeek: number;
  billMedian: number;
  setup?: { title: string; detail: string; saves: string };
};

export const TEAM_MEMBERS: Member[] = [
  { id: "dana.k", name: "Dana K.", initials: "DK", you: true, billRunsPerWeek: 15, billMedian: 250 },
  {
    id: "sam.r",
    name: "Sam R.",
    initials: "SR",
    billRunsPerWeek: 22,
    billMedian: 90,
    setup: {
      title: "Text-expander snippets for invoice fields",
      detail: "Sam pastes vendor, invoice # and total in three keystrokes. 1m 30s per bill vs 4m 10s for everyone else. It only exists on Sam's laptop.",
      saves: "2m 40s per bill",
    },
  },
  {
    id: "priya.m",
    name: "Priya M.",
    initials: "PM",
    billRunsPerWeek: 14,
    billMedian: 255,
    setup: {
      title: "Personal script that renames invoice PDFs",
      detail: "Priya runs a script that renames each PDF to Vendor_Invoice#.pdf before attaching it. Auditors ask for this; nobody else does it.",
      saves: "40s per bill, cleaner audits",
    },
  },
  { id: "alex.t", name: "Alex T.", initials: "AT", billRunsPerWeek: 9, billMedian: 280 },
];

// Groups that can turn a workflow on, from smallest to largest.
export const GROUP_SIZES: Record<string, number> = {
  me: 1,
  ap: 4,
  ar: 2,
  fpa: 1,
  finance: 7,
  purchasing: 2,
  warehouse: 3,
  ops: 5,
  platform: 4,
  eng: 4,
  people: 3,
  recruiting: 3,
  gtm: 7,
  sales: 4,
  support: 3,
  org: 33,
};

export const LAYER_GROUP: Record<LayerId, string> = { me: "me", ap: "ap", finance: "finance", org: "org" };

// Where each workflow already runs before the demo starts.
export const DEFAULT_ADOPTION: Record<string, string[]> = {
  [BILL_WORKFLOW_ID]: [],
  "categorize-card": ["purchasing"],
  "chase-overdue": ["ar"],
  "approve-po": [],
  "kpi-report": [],
  "bank-statements": [],
  "after-interview": ["recruiting"],
  "ticket-to-merge": ["platform"],
  "after-call": [],
  "ticket-triage": ["support"],
};

export const WORKFLOW_STEPS: Record<string, string[]> = {
  [BILL_WORKFLOW_ID]: ["Invoice email arrives", "Read invoice fields", "Match vendor + GL", "Hold over limit", "Post bill"],
  "categorize-card": ["Card transaction posts", "Match merchant", "Set GL + memo", "Attach receipt"],
  "chase-overdue": ["Invoice hits 30 days", "Draft reminder", "Escalate at 45 days", "Log in AR notes"],
  "match-bank": ["Bank line arrives", "Find bill by amount + vendor", "Match"],
  "bank-statements": ["Month closes", "Download statement", "Convert PDF → CSV", "Import to Ledgerline"],
  "accrual-je": ["Last business day", "Pull open POs", "Draft accrual entries"],
  "approve-po": ["Request posted in Slack", "Check budget", "Approve under limit"],
  "kpi-report": ["Friday 3pm", "Pull numbers", "Fill KPI sheet", "Post to #leadership"],
  "after-interview": ["Interview ends", "Stage + notes in ATS", "Email candidate times", "Book the panel"],
  "ticket-to-merge": ["Ticket assigned", "Branch + In Progress", "Draft PR linked", "On merge: #deploys + QA"],
  "after-call": ["Call ends", "Stage + notes in CRM", "Recap email draft", "Next task"],
  "ticket-triage": ["Ticket arrives", "Customer + billing pulled", "Credit under limit", "Reply + tag"],
};
