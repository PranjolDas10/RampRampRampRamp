"use client";

// Presenter mode for Ledgerline: a visible cursor clicks and types through the real app, so the
// recorder captures genuine events and the audience can follow each step. Marked data-cl1ck
// so the recorder ignores the bar itself.
import { useRef, useState } from "react";
import { Loader2, Play, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";
import { resetAll } from "@/lib/store";
import { cn } from "@/lib/utils";

type Actor = "Dana" | "cl1ck";

type Step = { key: string; chip: string; title: string; sub: string };

export const STEPS: Step[] = [
  { key: "manual1", chip: "By hand", title: "Dana enters an invoice by hand", sub: "cl1ck watches every field and where its value came from." },
  { key: "manual2", chip: "Again", title: "Same task, next invoice", sub: "Two runs make a pattern. All 4 people on AP do this." },
  { key: "assist", chip: "Auto-fill", title: "cl1ck fills the third one", sub: "7 fields from the email, GL account by vendor. Dana just posts." },
  { key: "team", chip: "Whole team", title: "Turned on for Accounts Payable", sub: "New invoices post themselves. Big ones wait. Duplicates get blocked." },
  { key: "share", chip: "Share", title: "Shared with Accounts Receivable", sub: "One step away in the org. They dry-run it, then adopt it." },
  { key: "claude", chip: "Claude", title: "A layout it has never seen", sub: "Claude reads it once. The next invoice from that vendor costs $0." },
];

export type DirectorHooks = {
  turnOnTeam: () => void;
  share: () => void;
  drainUntil: (emailIdPrefix: string) => void;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(selector: string, timeout = 6000): Promise<HTMLElement> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
    await sleep(50);
  }
  throw new Error(`Demo step couldn't find ${selector}`);
}

function setNativeValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
}

const MANUAL = [
  {
    email: "eml-001",
    values: {
      "#f-vendor": "V-1004 · Acme Roasting Supply",
      "#f-invno": "INV-4471",
      "#f-invdt": "09/28/2026",
      "#f-duedt": "10/28/2026",
      "#f-amt": "1835.00",
      "#f-gl": "5100 · Green Coffee Beans",
      "#f-memo": "Weekly green coffee",
    },
  },
  {
    email: "eml-002",
    values: {
      "#f-vendor": "V-1019 · Northfield Dairy Co.",
      "#f-invno": "NFD-20931",
      "#f-invdt": "09/29/2026",
      "#f-duedt": "10/14/2026",
      "#f-amt": "287.60",
      "#f-gl": "5200 · Dairy & Milk Alternatives",
      "#f-memo": "Dairy delivery",
    },
  },
];

export function Director({ hooks }: { hooks: DirectorHooks }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const [cursor, setCursor] = useState<{ x: number; y: number; actor: Actor; down: boolean } | null>(null);
  const actorRef = useRef<Actor>("Dana");

  const moveTo = async (el: HTMLElement, ms = 520) => {
    el.scrollIntoView({ block: "nearest" });
    const r = el.getBoundingClientRect();
    setCursor({ x: r.left + Math.min(r.width / 2, 48), y: r.top + r.height / 2, actor: actorRef.current, down: false });
    await sleep(ms);
  };

  const click = async (selector: string, ms?: number) => {
    const el = await waitFor(selector);
    await moveTo(el, ms);
    setCursor((c) => (c ? { ...c, down: true } : c));
    await sleep(110);
    el.click();
    setCursor((c) => (c ? { ...c, down: false } : c));
    await sleep(260);
  };

  const type = async (selector: string, text: string, perChar: number) => {
    const el = (await waitFor(selector)) as HTMLInputElement;
    await moveTo(el, 380);
    el.focus();
    for (let i = 1; i <= text.length; i++) {
      setNativeValue(el, text.slice(0, i));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(perChar);
    }
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
  };

  const choose = async (selector: string, option: string) => {
    const el = (await waitFor(selector)) as HTMLSelectElement;
    await moveTo(el, 380);
    el.focus();
    setNativeValue(el, option);
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
    await sleep(150);
  };

  const manualEntry = async (i: number, perChar: number) => {
    const run = MANUAL[i];
    actorRef.current = "Dana";
    await click('[data-demo="nav-inbox"]');
    await click(`[data-demo="email-${run.email}"]`);
    await sleep(900); // reading the invoice
    await click('[data-demo="toolbar-new-bill"]');
    for (const [sel, value] of Object.entries(run.values)) {
      if (sel === "#f-vendor" || sel === "#f-gl") await choose(sel, value);
      else await type(sel, value, perChar);
    }
    await click('[data-demo="post"]');
  };

  const scripts: Record<string, () => Promise<void>> = {
    manual1: () => manualEntry(0, 45),
    manual2: async () => {
      await manualEntry(1, 18);
      await waitFor('[data-demo="discovery"]', 3000).catch(() => undefined);
    },
    assist: async () => {
      const gotIt = document.querySelector<HTMLElement>('[data-demo="got-it"]');
      if (gotIt) await click('[data-demo="got-it"]');
      actorRef.current = "Dana";
      await click('[data-demo="nav-inbox"]');
      await click('[data-demo="email-eml-004"]');
      await sleep(500);
      await click('[data-demo="toolbar-new-bill"]');
      actorRef.current = "cl1ck";
      await click('[data-demo="fill"]', 700);
      await sleep(1400);
      actorRef.current = "Dana";
      await click('[data-demo="post"]');
    },
    team: async () => {
      actorRef.current = "cl1ck";
      hooks.turnOnTeam();
      await sleep(900);
      for (let i = 0; i < 3; i++) {
        await click('[data-demo="send-receive"]', 420);
        await sleep(1100);
      }
      await click('[data-demo="toolbar-bills"]');
    },
    share: async () => {
      hooks.share();
      await sleep(400);
    },
    claude: async () => {
      actorRef.current = "cl1ck";
      hooks.drainUntil("eml-107");
      await click('[data-demo="send-receive"]', 420);
      await waitFor('[data-demo="toast-claude-done"]', 20000).catch(() => undefined);
      await sleep(1200);
      await click('[data-demo="send-receive"]', 420);
      await sleep(800);
      await click('[data-demo="toolbar-bills"]');
    },
  };

  const run = async (i: number) => {
    if (busy) return;
    setBusy(true);
    setStep(i);
    try {
      await scripts[STEPS[i].key]();
      setDone((d) => Array.from(new Set([...d, i])));
      if (i < STEPS.length - 1) setStep(i + 1);
    } catch (err) {
      console.warn(err);
    } finally {
      setBusy(false);
      setCursor(null);
    }
  };

  const current = STEPS[step];

  return (
    <div data-cl1ck className="font-sans" style={{ fontFeatureSettings: '"ss01"' }}>
      <div className="sticky top-0 z-[60] border-b border-hairline bg-paper text-ink">
        {open ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
            <div className="flex items-center gap-1">
              {STEPS.map((s, i) => (
                <button
                  key={s.key}
                  disabled={busy}
                  onClick={() => setStep(i)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] transition-colors duration-300",
                    i === step ? "bg-ink text-paper" : done.includes(i) ? "text-ink" : "text-ash hover:text-ink",
                  )}
                >
                  {i + 1} {s.chip}
                  {done.includes(i) && i !== step ? " ✓" : ""}
                </button>
              ))}
            </div>
            <div className="min-w-[280px] flex-1">
              <div className="text-sm leading-tight">{current.title}</div>
              <div className="text-xs text-ash">{current.sub}</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => run(step)}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-highlight px-3.5 text-xs text-ink hover:bg-[#d6e41a] disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                {busy ? "Running" : done.includes(step) ? "Replay" : "Play"}
              </button>
              <button
                onClick={() => {
                  resetAll();
                  window.location.reload();
                }}
                disabled={busy}
                className="inline-flex h-8 items-center rounded-md px-2.5 text-xs text-ink hover:bg-bone"
                aria-label="Reset demo"
              >
                <RotateCcw className="size-3.5" />
              </button>
              <button onClick={() => setOpen(false)} className="inline-flex h-8 items-center rounded-md px-2 text-ash hover:bg-bone" aria-label="Hide">
                <ChevronUp className="size-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-1 py-1 text-[11px] text-ash hover:text-ink">
            <ChevronDown className="size-3" /> Presenter
          </button>
        )}
      </div>

      {cursor && (
        <div
          className="pointer-events-none fixed top-0 left-0 z-[70] transition-transform duration-500 ease-out"
          style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            className={cn("drop-shadow transition-transform duration-100", cursor.down && "scale-75")}
            style={{ transformOrigin: "2px 2px" }}
          >
            <path d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.5 L11 13 L18 13 Z" fill={cursor.actor === "Dana" ? "#0c0a08" : "#e4f222"} stroke={cursor.actor === "Dana" ? "#ffffff" : "#0c0a08"} strokeWidth="1.3" />
          </svg>
          <span
            className={cn(
              "absolute top-5 left-4 rounded-md px-1.5 py-0.5 text-[10px] whitespace-nowrap",
              cursor.actor === "Dana" ? "bg-ink text-paper" : "bg-highlight text-ink",
            )}
          >
            {cursor.actor === "Dana" ? "Dana · by hand" : "cl1ck"}
          </span>
        </div>
      )}
    </div>
  );
}
