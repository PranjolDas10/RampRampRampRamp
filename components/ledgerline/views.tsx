"use client";

import { fmtMoney } from "@/lib/format";
import {
  ACCOUNT_OPTIONS,
  VENDOR_OPTIONS,
  accountByCode,
  emailHeaderBlocks,
  invoiceBlocks,
  vendorById,
  type DocBlock,
} from "@/lib/seed";
import type { Bill, Email } from "@/lib/types";

export function InboxView({ emails, onOpen }: { emails: Email[]; onOpen: (id: string) => void }) {
  const unread = emails.filter((e) => e.status === "unread").length;
  return (
    <>
      <h2 className="ll-h">AP Inbox ({unread} unread)</h2>
      <table className="ll-grid">
        <thead>
          <tr>
            <th style={{ width: 18 }}>!</th>
            <th>From</th>
            <th>Subject</th>
            <th>Received</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {emails.map((e) => (
            <tr
              key={e.id}
              className={`click ${e.status === "unread" ? "unread" : ""} ${e.status === "done" ? "done" : ""}`}
              onClick={() => onOpen(e.id)}
              data-demo={`email-${e.id}`}
              role="button"
              aria-label={`Open email ${e.subject}`}
            >
              <td>{e.invoice ? "📎" : ""}</td>
              <td>{e.from}</td>
              <td>{e.subject}</td>
              <td>{e.received || "Just now"}</td>
              <td>
                {e.status === "done" ? (
                  <span className="ll-pill green">Entered</span>
                ) : e.status === "unread" ? (
                  <span className="ll-pill blue">New</span>
                ) : (
                  <span className="ll-pill grey">Read</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 6, color: "#555" }}>
        Showing 1-{emails.length} of {emails.length} | Sort: Received ▼ | Mail connector v2.1 (IMAP)
      </p>
    </>
  );
}

function Block({ b }: { b: DocBlock }) {
  switch (b.kind) {
    case "kv":
      return (
        <div className="kv">
          <span>{b.label}:</span> <span>{b.value}</span>
        </div>
      );
    case "text":
      return <p style={{ margin: "8px 0" }}>{b.text}</p>;
    case "letterhead":
      return (
        <>
          <div className="lh-name">{b.name}</div>
          <div className="lh-addr">{b.address}</div>
        </>
      );
    case "title":
      return <div className="doc-title">{b.text}</div>;
    case "total":
      return (
        <div className="total">
          {b.label} {b.value}
        </div>
      );
    default:
      return null;
  }
}

export function EmailView({ email, onBack, onEnter }: { email: Email; onBack: () => void; onEnter: () => void }) {
  const doc = invoiceBlocks(email);
  const rows = doc.filter((b): b is Extract<DocBlock, { kind: "row" }> => b.kind === "row");
  const before = doc.filter((b) => b.kind !== "row" && b.kind !== "total");
  const total = doc.find((b) => b.kind === "total");
  return (
    <>
      <h2 className="ll-h">{email.subject}</h2>
      <div className="ll-box ll-mail-h">
        {emailHeaderBlocks(email)
          .filter((b) => b.kind === "kv")
          .map((b, i) => (
            <Block key={i} b={b} />
          ))}
      </div>
      <div>
        {emailHeaderBlocks(email)
          .filter((b) => b.kind === "text")
          .map((b, i) => (
            <Block key={i} b={b} />
          ))}
      </div>
      {email.invoice && (
        <>
          <div style={{ color: "#555", marginTop: 8 }}>Attachment: invoice.pdf (1 page, 84 KB)</div>
          <div className="ll-doc">
            {before.map((b, i) => (
              <Block key={i} b={b} />
            ))}
            <table>
              <tbody>
                {rows.map((r, i) =>
                  r.header ? (
                    <tr key={i}>
                      {r.cells.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  ) : (
                    <tr key={i}>
                      {r.cells.map((c, j) => (
                        <td key={j}>{c}</td>
                      ))}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            {total && <Block b={total} />}
          </div>
        </>
      )}
      <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
        <button className="ll-btn" onClick={onBack}>
          &lt; Back to Inbox
        </button>
        {email.invoice && email.status !== "done" && (
          <button className="ll-btn" onClick={onEnter}>
            Go to Bills
          </button>
        )}
      </div>
    </>
  );
}

export function BillsView({ bills, onNew }: { bills: Bill[]; onNew: () => void }) {
  const rows = [...bills].sort((a, b) => b.createdAt - a.createdAt).slice(0, 14);
  return (
    <>
      <h2 className="ll-h">Accounts Payable: Bills</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <button className="ll-btn primary" onClick={onNew}>
          New Bill
        </button>
        <button className="ll-btn" disabled>
          Batch Post
        </button>
        <button className="ll-btn" disabled>
          Export
        </button>
      </div>
      <table className="ll-grid">
        <thead>
          <tr>
            <th>Bill #</th>
            <th>Vendor</th>
            <th>Invoice No.</th>
            <th>Inv. Date</th>
            <th>Due Date</th>
            <th style={{ textAlign: "right" }}>Amount</th>
            <th>GL</th>
            <th>Status</th>
            <th>Entered By</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td>{b.id}</td>
              <td>{vendorById(b.vendorId)?.name ?? b.vendorId}</td>
              <td>{b.invoiceNo}</td>
              <td>{b.invoiceDate}</td>
              <td>{b.dueDate}</td>
              <td style={{ textAlign: "right" }}>{fmtMoney(b.amount)}</td>
              <td title={accountByCode(b.gl)?.name}>{b.gl}</td>
              <td>
                <span
                  className={`ll-pill ${b.status === "Posted" ? "green" : b.status === "Voided" ? "grey" : "amber"}`}
                >
                  {b.status}
                </span>
              </td>
              <td>{b.createdBy === "cl1ck" ? "✦ cl1ck" : b.createdBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 6, color: "#555" }}>
        Page 1 of {Math.max(1, Math.ceil(bills.length / 14))} | 14 rows per page | Period OCT-2026
      </p>
    </>
  );
}

export const EMPTY_FORM: Record<string, string> = {
  Vendor: "",
  "Invoice No.": "",
  "Invoice Date": "",
  "Due Date": "",
  Amount: "",
  "GL Account": "",
  Memo: "",
};

const FIELD_IDS: Record<string, string> = {
  Vendor: "f-vendor",
  "Invoice No.": "f-invno",
  "Invoice Date": "f-invdt",
  "Due Date": "f-duedt",
  Amount: "f-amt",
  "GL Account": "f-gl",
  Memo: "f-memo",
};

export function BillForm({
  form,
  setField,
  auto,
  errors,
  onSubmit,
  onCancel,
}: {
  form: Record<string, string>;
  setField: (field: string, value: string) => void;
  auto: Record<string, string>;
  errors: string[];
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const row = (field: string, input: React.ReactNode, hint?: string, required = true) => (
    <>
      <label htmlFor={FIELD_IDS[field]}>
        {field}
        {required && <span className="req"> *</span>}
      </label>
      {input}
      <div className={auto[field] ? "ll-tag" : "hint"}>{auto[field] ? `✦ ${auto[field]}` : hint}</div>
    </>
  );
  const cls = (f: string) => (auto[f] ? "ll-auto" : "");
  return (
    <>
      <h2 className="ll-h">New Bill (Vendor Invoice Entry)</h2>
      {errors.length > 0 && (
        <div className="ll-err">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
      <form
        aria-label="Post Bill"
        className="ll-box"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="ll-form">
          {row(
            "Vendor",
            <select
              id={FIELD_IDS.Vendor}
              className={cls("Vendor")}
              value={form.Vendor}
              onChange={(e) => setField("Vendor", e.target.value)}
            >
              <option value="">-- Select vendor (by code) --</option>
              {VENDOR_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>,
            "Vendor must exist in Vendor Master",
          )}
          {row(
            "Invoice No.",
            <input
              id={FIELD_IDS["Invoice No."]}
              className={cls("Invoice No.")}
              value={form["Invoice No."]}
              onChange={(e) => setField("Invoice No.", e.target.value)}
              autoComplete="off"
            />,
            "As printed on vendor invoice",
          )}
          {row(
            "Invoice Date",
            <input
              id={FIELD_IDS["Invoice Date"]}
              className={cls("Invoice Date")}
              value={form["Invoice Date"]}
              onChange={(e) => setField("Invoice Date", e.target.value)}
              placeholder="MM/DD/YYYY"
              autoComplete="off"
            />,
            "Format MM/DD/YYYY only",
          )}
          {row(
            "Due Date",
            <input
              id={FIELD_IDS["Due Date"]}
              className={cls("Due Date")}
              value={form["Due Date"]}
              onChange={(e) => setField("Due Date", e.target.value)}
              placeholder="MM/DD/YYYY"
              autoComplete="off"
            />,
            "Format MM/DD/YYYY only",
          )}
          {row(
            "Amount",
            <input
              id={FIELD_IDS.Amount}
              className={cls("Amount")}
              value={form.Amount}
              onChange={(e) => setField("Amount", e.target.value)}
              autoComplete="off"
            />,
            "USD, no currency symbol",
          )}
          {row(
            "GL Account",
            <select
              id={FIELD_IDS["GL Account"]}
              className={cls("GL Account")}
              value={form["GL Account"]}
              onChange={(e) => setField("GL Account", e.target.value)}
            >
              <option value="">-- Select account --</option>
              {ACCOUNT_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>,
            "Chart of Accounts, FY2026",
          )}
          {row(
            "Memo",
            <input
              id={FIELD_IDS.Memo}
              className={cls("Memo")}
              value={form.Memo}
              onChange={(e) => setField("Memo", e.target.value)}
              autoComplete="off"
            />,
            "Optional, 60 chars max",
            false,
          )}
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 6, paddingLeft: 128 }}>
          <button type="submit" data-demo="post" className="ll-btn primary">
            Post Bill
          </button>
          <button type="button" className="ll-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
