"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SETTINGS,
  KEYS,
  NO_DISMISSED,
  NO_SEEN,
  dismissSuggestion,
  getMode,
  logAssist,
  logEvent,
  propose,
  readWithClaude,
  receiveNextEmail,
  shareWith,
  turnOnFor,
  QUEUE_IDS,
} from "@/lib/automation";
import { fmtMoney, mdyToIso, uid } from "@/lib/format";
import { startRecorder, type Recorder } from "@/lib/recorder";
import { BILL_WORKFLOW_ID, COMPANY, CURRENT_USER, DEFAULT_MODES, INITIAL_BILLS, INITIAL_EMAILS, TEAM_PATTERNS } from "@/lib/seed";
import { read, update, useStored, write } from "@/lib/store";
import type { Bill, Email, Run } from "@/lib/types";
import { useCl1ck } from "@/lib/use-cl1ck";
import { Director, type DirectorHooks } from "./director";
import { Cl1ckOverlay, type OverlayToast } from "./overlay";
import { BillForm, BillsView, EMPTY_FORM, EmailView, InboxView } from "./views";

type View = { name: "inbox" } | { name: "email"; id: string } | { name: "bills" } | { name: "newBill" };

const routeOf = (v: View) =>
  v.name === "inbox" ? "/inbox" : v.name === "email" ? `/inbox/${v.id}` : v.name === "bills" ? "/bills" : "/bills/new";

const appOf = (route: string) => (route.startsWith("/inbox") ? "Inbox" : "Ledgerline");

function toastFor(run: Run): OverlayToast {
  const amount = fmtMoney(run.amount);
  if (run.status === "Needs read")
    return { id: run.id, tone: "warn", title: `Couldn't read ${run.vendor}'s invoice`, body: run.flags[0] };
  if (run.status === "Blocked")
    return { id: run.id, tone: "block", title: `Blocked duplicate ${run.invoiceNo}`, body: `${run.flags[0]} · saved ${amount}` };
  if (run.status === "Awaiting approval")
    return { id: run.id, tone: "warn", title: `Drafted ${run.invoiceNo} · ${amount}`, body: run.flags.join(" · ") || "Waiting for approval in cl1ck" };
  return { id: run.id, tone: "ok", title: `Posted ${run.invoiceNo} from ${run.vendor}`, body: `${amount} · ${run.fields} fields · ${run.flags.join(" · ") || "no manual steps"}` };
}

export function Ledgerline() {
  const rootRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const [view, setView] = useState<View>({ name: "inbox" });
  const routeRef = useRef(routeOf(view));
  const [lastEmailId, setLastEmailId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM);
  const [auto, setAuto] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [toasts, setToasts] = useState<OverlayToast[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);

  const emails = useStored<Email[]>(KEYS.emails, INITIAL_EMAILS);
  const bills = useStored<Bill[]>(KEYS.bills, INITIAL_BILLS);
  const queue = useStored<string[]>(KEYS.queue, QUEUE_IDS);
  const modes = useStored(KEYS.modes, DEFAULT_MODES);
  const settings = useStored(KEYS.settings, DEFAULT_SETTINGS);
  const seen = useStored(KEYS.seen, NO_SEEN);
  const dismissed = useStored(KEYS.dismissed, NO_DISMISSED);
  const u = useCl1ck();
  const mode = modes[BILL_WORKFLOW_ID] ?? "off";

  // Start the generic recorder once. It only needs a root element and the current route.
  useEffect(() => {
    if (!rootRef.current) return;
    const rec = startRecorder({
      root: rootRef.current,
      app: appOf,
      getRoute: () => routeRef.current,
      emit: (e) => {
        if (read(KEYS.settings, DEFAULT_SETTINGS).paused) return;
        logEvent(e);
      },
    });
    recorderRef.current = rec;
    rec.navigate(routeRef.current);
    return () => rec.stop();
  }, []);

  const go = (v: View) => {
    routeRef.current = routeOf(v);
    setView(v);
    recorderRef.current?.navigate(routeOf(v));
  };

  const openEmail = (id: string) => {
    setLastEmailId(id);
    update<Email[]>(KEYS.emails, INITIAL_EMAILS, (prev) =>
      prev.map((e) => (e.id === id && e.status === "unread" ? { ...e, status: "read" } : e)),
    );
    go({ name: "email", id });
  };

  const newBill = () => {
    setForm(EMPTY_FORM);
    setAuto({});
    setErrors([]);
    go({ name: "newBill" });
  };

  const pushToast = (t: OverlayToast) => {
    setToasts((prev) => [t, ...prev].slice(0, 3));
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 9000);
  };

  const sendReceive = () => {
    const { email, run } = receiveNextEmail(u.rules, u.manualSeconds);
    if (!email) {
      pushToast({ id: uid("t"), tone: "info", title: "No new messages" });
      return;
    }
    if (run?.status === "Needs read") {
      const readingId = uid("t");
      pushToast({
        id: readingId,
        tone: "info",
        title: `New layout from ${email.from}`,
        body: "Claude is reading it once. After that, this vendor's invoices are free.",
      });
      readWithClaude(run.id, u.rules, u.manualSeconds).then((done) => {
        setToasts((prev) => prev.filter((t) => t.id !== readingId));
        if (done) pushToast({ ...toastFor(done), demo: "claude-done" });
      });
      return;
    }
    pushToast(run ? toastFor(run) : { id: uid("t"), tone: "info", title: `New email from ${email.from}`, body: email.subject });
  };

  const post = () => {
    const errs: string[] = [];
    if (!form.Vendor) errs.push("ERR-1104: VENDOR_ID is required");
    if (!form["Invoice No."].trim()) errs.push("ERR-1120: INV_NO is required");
    if (!mdyToIso(form["Invoice Date"])) errs.push("ERR-2201: INV_DT must be MM/DD/YYYY");
    if (!mdyToIso(form["Due Date"])) errs.push("ERR-2202: DUE_DT must be MM/DD/YYYY");
    const amount = Number(form.Amount.replace(/,/g, ""));
    if (!(amount > 0) || /[^0-9.,]/.test(form.Amount)) errs.push("ERR-3310: AMT invalid (numbers only)");
    if (!form["GL Account"]) errs.push("ERR-4002: GL_ACCT is required");
    setErrors(errs);
    if (errs.length) return;
    const vendorId = form.Vendor.split(" ")[0];
    const invoiceNo = form["Invoice No."].trim();
    const email = emails.find((e) => e.invoice?.number === invoiceNo && e.invoice.vendorId === vendorId);
    const bill: Bill = {
      id: `B-${24100 + Math.floor(Math.random() * 899)}`,
      vendorId,
      invoiceNo,
      invoiceDate: form["Invoice Date"],
      dueDate: form["Due Date"],
      amount,
      gl: form["GL Account"].split(" ")[0],
      memo: form.Memo,
      status: "Posted",
      createdBy: CURRENT_USER,
      createdAt: Date.now(),
      emailId: email?.id,
    };
    update<Bill[]>(KEYS.bills, INITIAL_BILLS, (prev) => [bill, ...prev]);
    if (email) {
      update<Email[]>(KEYS.emails, INITIAL_EMAILS, (prev) =>
        prev.map((e) => (e.id === email.id ? { ...e, status: "done" } : e)),
      );
    }
    setForm(EMPTY_FORM);
    setAuto({});
    go({ name: "bills" });
  };

  const currentEmail = useMemo(() => emails.find((e) => e.id === lastEmailId), [emails, lastEmailId]);
  const formEmpty = Object.values(form).every((v) => !v) && Object.keys(auto).length === 0;
  const teamPattern = TEAM_PATTERNS[0];

  const suggestion =
    u.discovered &&
    mode !== "off" &&
    view.name === "newBill" &&
    formEmpty &&
    currentEmail?.invoice &&
    currentEmail.status !== "done" &&
    !skipped.includes(currentEmail.id) &&
    (dismissed[BILL_WORKFLOW_ID] ?? 0) < 2
      ? {
          vendor: currentEmail.from,
          fields: Object.keys(propose(currentEmail, u.rules)).length,
          seconds: Math.max(30, u.manualSeconds - 20),
          teammates: 3,
        }
      : null;

  const fill = () => {
    if (!currentEmail) return;
    const proposal = propose(currentEmail, u.rules);
    const entries = Object.entries(proposal);
    entries.forEach(([field, p], i) => {
      window.setTimeout(() => {
        setForm((f) => ({ ...f, [field]: p.value }));
        setAuto((a) => ({
          ...a,
          [field]: p.how === "email" ? `from email · ${p.from}` : p.how === "rule" ? `rule · by ${p.from}` : "team default",
        }));
      }, 140 * i);
    });
    recorderRef.current?.automation(`Filled ${entries.length} fields from ${currentEmail.from}'s email`);
    logAssist(currentEmail, entries.length, u.manualSeconds);
  };

  const director: DirectorHooks = {
    turnOnTeam: () => {
      turnOnFor(BILL_WORKFLOW_ID, "ap", "auto");
      pushToast({ id: uid("t"), tone: "ok", title: "On for Accounts Payable", body: "4 people · guardrails on" });
    },
    share: () => {
      shareWith("ar");
      pushToast({ id: uid("t"), tone: "info", title: "Shared with Accounts Receivable", body: "Dry run on their history: 18/20 · adopted" });
    },
    drainUntil: (id) => {
      for (let i = 0; i < 10; i++) {
        const q = read<string[]>(KEYS.queue, QUEUE_IDS);
        if (!q.length || q[0] === id) break;
        receiveNextEmail(u.rules, u.manualSeconds);
      }
    },
  };

  const discoveryCard =
    u.discovered && !seen.discovered ? { runs: u.myRuns.length, teamRuns: teamPattern.runsPerWeek } : null;

  const unread = emails.filter((e) => e.status === "unread").length;
  const crumbs: Record<View["name"], string> = {
    inbox: "Home > Mail > AP Inbox",
    email: "Home > Mail > AP Inbox > Message",
    bills: "Home > Accounts Payable > Bills",
    newBill: "Home > Accounts Payable > Bills > New Bill",
  };

  return (
    <div className="ll" ref={rootRef}>
      <Director hooks={director} />
      <div className="ll-title">
        <span className="ll-logo">LL</span>
        Ledgerline Enterprise 8.2 — {COMPANY}
        <span className="ll-right">
          <span>User: {CURRENT_USER}</span>
          <a href="#" onClick={(e) => e.preventDefault()}>
            Help
          </a>
          <a href="#" onClick={(e) => e.preventDefault()}>
            Log off
          </a>
        </span>
      </div>
      <div className="ll-menu">
        {["File", "Edit", "View", "Transactions", "Reports", "Window", "Help"].map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
      <div className="ll-toolbar">
        <button className="ll-tbtn" data-demo="send-receive" onClick={sendReceive} title="Check for new mail">
          <span className="ico">✉</span> Send/Receive{queue.length ? ` (${queue.length})` : ""}
        </button>
        <span className="ll-sep" />
        <button className="ll-tbtn" data-demo="toolbar-new-bill" onClick={newBill}>
          <span className="ico">+</span> New Bill
        </button>
        <button className="ll-tbtn" onClick={() => go({ name: "inbox" })}>
          <span className="ico">⌂</span> Inbox
        </button>
        <button className="ll-tbtn" data-demo="toolbar-bills" onClick={() => go({ name: "bills" })}>
          <span className="ico">≡</span> Bills
        </button>
        <span className="ll-sep" />
        <button className="ll-tbtn" disabled>
          <span className="ico">⎙</span> Print
        </button>
        <span style={{ marginLeft: "auto", color: "#555" }}>
          Workflow: {getMode() === "off" ? "manual" : "cl1ck " + mode}
        </span>
      </div>
      <div className="ll-body">
        <nav className="ll-nav">
          <div className="grp">Mail</div>
          <button
            data-demo="nav-inbox"
            className={view.name === "inbox" || view.name === "email" ? "on" : ""}
            onClick={() => go({ name: "inbox" })}
          >
            AP Inbox ({unread})
          </button>
          <div className="grp">Accounts Payable</div>
          <button className={view.name === "bills" || view.name === "newBill" ? "on" : ""} onClick={() => go({ name: "bills" })}>
            Bills
          </button>
          <button className="dis" title="Module not licensed">Vendors</button>
          <button className="dis" title="Module not licensed">Payments</button>
          <div className="grp">Accounts Receivable</div>
          <button className="dis">Invoices</button>
          <div className="grp">General Ledger</div>
          <button className="dis">Journal Entries</button>
          <button className="dis">Chart of Accounts</button>
          <div className="grp">Reports</div>
          <button className="dis">AP Aging</button>
          <button className="dis">P&amp;L</button>
        </nav>
        <main className="ll-main">
          <div className="ll-crumb">
            <b>Location:</b> {crumbs[view.name]}
          </div>
          <div data-us-main>
            {view.name === "inbox" && <InboxView emails={emails} onOpen={openEmail} />}
            {view.name === "email" && currentEmail && (
              <EmailView email={currentEmail} onBack={() => go({ name: "inbox" })} onEnter={() => go({ name: "bills" })} />
            )}
            {view.name === "bills" && <BillsView bills={bills} onNew={newBill} />}
            {view.name === "newBill" && (
              <BillForm
                form={form}
                setField={(f, v) => {
                  setForm((prev) => ({ ...prev, [f]: v }));
                  setAuto((a) => {
                    if (!a[f]) return a;
                    const next = { ...a };
                    delete next[f];
                    return next;
                  });
                }}
                auto={auto}
                errors={errors}
                onSubmit={post}
                onCancel={() => go({ name: "bills" })}
              />
            )}
          </div>
        </main>
      </div>
      <div className="ll-status">
        <span>Ready</span>
        <span>Period: OCT-2026 (OPEN)</span>
        <span>Company: JUN01</span>
        <span>Server: LL-PROD-02</span>
        <span>Recorder: {settings.paused ? "paused" : "on"}</span>
      </div>
      <Cl1ckOverlay
        events={u.events.length}
        paused={!!settings.paused}
        onTogglePause={() => write(KEYS.settings, { ...settings, paused: !settings.paused })}
        discoveryCard={discoveryCard}
        onDiscoveryDone={() => write(KEYS.seen, { ...seen, discovered: true })}
        suggestion={suggestion}
        onFill={fill}
        onNotNow={() => {
          if (currentEmail) setSkipped((s) => [...s, currentEmail.id]);
          dismissSuggestion(BILL_WORKFLOW_ID);
        }}
        toasts={toasts}
        onDismissToast={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
