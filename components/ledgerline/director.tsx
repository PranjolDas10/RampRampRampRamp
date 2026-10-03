"use client";

// Coach mode for Ledgerline: guides a first-time visitor through the real app.
// Scripted cursor still runs the same steps; the bar explains what's happening in plain English.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Play, RotateCcw, ChevronUp, ChevronDown, ArrowRight } from "lucide-react";
import { KEYS, NO_RUNS } from "@/lib/automation";
import { fmtDuration, fmtMoney0 } from "@/lib/format";
import { resetAll, useStored } from "@/lib/store";
import type { Run } from "@/lib/types";
import { useCl1ck } from "@/lib/use-cl1ck";
import { cn } from "@/lib/utils";

type Actor = "Dana" | "cl1ck";

type Step = {
  key: string;
  chip: string;
  title: string;
  do: string;
  watching: string;
  why: string;
  handsOn?: boolean;
};

export const STEPS: Step[] = [
  {
    key: "manual1",
    chip: "By hand",
    title: "Enter the first invoice",
    do: "Open the Acme email, click New Bill, fill the seven fields from the invoice, then Post.",
    watching: "cl1ck records each field and finds where its value came from in the email.",
    why: "No one had to set up rules or map fields — the recorder learns by watching.",
    handsOn: true,
  },
  {
    key: "manual2",
    chip: "Again",
    title: "Enter a second invoice",
    do: "Same task, next invoice. Two runs of the same work make a pattern.",
    watching: "cl1ck compares this run to the first one and confirms the fields match.",
    why: "Everyone on the accounting team does this. One person's habit can become the team's.",
  },
  {
    key: "assist",
    chip: "Auto-fill",
    title: "cl1ck fills the third one",
    do: "Open the next invoice and let cl1ck fill the form. You only need to click Post.",
    watching: "Seven fields come from the email; the GL account is decided by the vendor.",
    why: "A four-minute task becomes one click after two manual runs.",
  },
  {
    key: "team",
    chip: "Whole team",
    title: "Turn it on for the team",
    do: "New invoices arrive and cl1ck handles them. Watch the toasts.",
    watching: "One posts itself, a large one waits for approval, and a duplicate gets blocked.",
    why: "Guardrails protect money: approval limits, early-pay discounts, and duplicate blocks.",
  },
  {
    key: "share",
    chip: "Share",
    title: "Share one step over",
    do: "The Accounts Payable workflow is offered to Accounts Receivable.",
    watching: "They dry-run it on their own history, then adopt it. Vendor names and amounts are stripped first.",
    why: "Sharing stays inside the org, one step at a time — never a free-for-all.",
  },
  {
    key: "claude",
    chip: "New layout",
    title: "A layout it has never seen",
    do: "An invoice arrives with unfamiliar labels. Claude reads it once.",
    watching: "cl1ck keeps the labels only if the free extractor reproduces Claude's values.",
    why: "The next invoice from that vendor costs $0. AI only where rules can't reach.",
  },
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

function resultFor(step: number, myRuns: number, discovered: boolean, runs: Run[]): string | null {
  if (step === 0 && myRuns >= 1) {
    const fields = Object.keys(MANUAL[0].values).length;
    return `Recorded ${fields} fields from the first invoice.`;
  }
  if (step === 1 && myRuns >= 2) {
    return discovered ? "Pattern found after 2 runs. Ready to suggest auto-fill." : "Second run recorded.";
  }
  if (step === 2) {
    const filled = runs.filter((r) => r.fields >= 5);
    if (filled.length) return `Filled ${filled[filled.length - 1]?.fields ?? 7} of 7 fields from the email.`;
    return null;
  }
  if (step === 3) {
    const blocked = runs.filter((r) => r.status === "Blocked");
    const held = runs.filter((r) => r.status === "Awaiting approval");
    const posted = runs.filter((r) => r.status === "Posted");
    if (blocked.length || held.length || posted.length) {
      return `${posted.length} posted · ${held.length} held for approval · ${blocked.length} duplicate blocked.`;
    }
    return null;
  }
  if (step === 4) return "Shared with Accounts Receivable. They dry-ran it, then adopted it.";
  if (step === 5) {
    const claude = runs.find((r) => r.flags.some((f) => f.startsWith("Read by Claude")));
    if (claude) {
      const cost = claude.flags.find((f) => f.includes("$"));
      return cost ?? "Claude read the layout once. Next invoice from that vendor is free.";
    }
    return null;
  }
  return null;
}

export function Director({ hooks }: { hooks: DirectorHooks }) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const [handsOn, setHandsOn] = useState(false);
  const [showImpact, setShowImpact] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number; actor: Actor; down: boolean } | null>(null);
  const actorRef = useRef<Actor>("Dana");
  const handsBaseline = useRef(0);
  const u = useCl1ck();
  const runs = useStored<Run[]>(KEYS.runs, NO_RUNS);

  // Advance step 1 when the visitor posts a bill themselves.
  useEffect(() => {
    if (!handsOn || busy || step !== 0) return;
    if (u.myRuns.length > handsBaseline.current) {
      setHandsOn(false);
      setDone((d) => Array.from(new Set([...d, 0])));
      setStep(1);
    }
  }, [u.myRuns.length, handsOn, busy, step]);

  const impact = useMemo(() => {
    const live = runs.filter((r) => r.status !== "Undone");
    const seconds = live.reduce((s, r) => s + r.seconds, 0);
    const protectedAmt = live.reduce((s, r) => s + r.protected, 0);
    const autoFields = live.reduce((s, r) => s + r.fields, 0);
    const claudeFlag = live.flatMap((r) => r.flags).find((f) => f.startsWith("Read by Claude"));
    const costMatch = claudeFlag?.match(/\$[\d.]+/);
    return {
      seconds,
      protectedAmt,
      autoFields,
      blocked: live.filter((r) => r.status === "Blocked").length,
      held: live.filter((r) => r.status === "Awaiting approval").length,
      claudeCost: costMatch?.[0] ?? null,
      runs: live.length,
    };
  }, [runs]);

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
    await sleep(900);
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
    setHandsOn(false);
    setBusy(true);
    setStep(i);
    try {
      await scripts[STEPS[i].key]();
      setDone((d) => Array.from(new Set([...d, i])));
      if (i < STEPS.length - 1) setStep(i + 1);
      else setShowImpact(true);
    } catch (err) {
      console.warn(err);
    } finally {
      setBusy(false);
      setCursor(null);
    }
  };

  const startHandsOn = () => {
    handsBaseline.current = u.myRuns.length;
    setHandsOn(true);
  };

  const current = STEPS[step];
  const result = resultFor(step, u.myRuns.length, u.discovered, runs) ?? (done.includes(step) ? resultFor(step, Math.max(u.myRuns.length, step + 1), true, runs) : null);

  if (!started) {
    return (
      <div data-cl1ck className="font-sans" style={{ fontFeatureSettings: '"ss01"' }}>
        <div className="sticky top-0 z-[60] border-b border-hairline bg-paper text-ink">
          <div className="mx-auto flex max-w-[960px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-[560px] space-y-1.5">
              <div className="text-[11px] tracking-wide text-ash uppercase">Guided tour · ~2 minutes</div>
              <div className="text-sm leading-snug text-ink">
                You&apos;re <b className="font-normal">Dana</b>, an accountant at{" "}
                <b className="font-normal">Juniper Coffee Roasters</b> (a sample company). Every invoice that arrives by
                email gets retyped into Ledgerline — a deliberately old accounting app. cl1ck runs quietly on top of it.
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link href="/" className="inline-flex h-8 items-center rounded-md px-2.5 text-xs text-ash hover:text-ink">
                Back
              </Link>
              <button
                onClick={() => setStarted(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-highlight px-3.5 text-xs text-ink hover:bg-[#d6e41a]"
              >
                Start tour <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showImpact) {
    return (
      <div data-cl1ck className="font-sans" style={{ fontFeatureSettings: '"ss01"' }}>
        <div className="sticky top-0 z-[60] border-b border-hairline bg-paper text-ink">
          <div className="mx-auto max-w-[960px] space-y-3 px-4 py-4">
            <div className="text-[11px] tracking-wide text-ash uppercase">Impact from this tour</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ImpactStat label="Time saved" value={fmtDuration(impact.seconds)} />
              <ImpactStat label="Money protected" value={fmtMoney0(impact.protectedAmt)} />
              <ImpactStat label="Fields filled by cl1ck" value={String(impact.autoFields)} />
              <ImpactStat
                label="Claude cost"
                value={impact.claudeCost ?? (impact.runs ? "rules only" : "—")}
              />
            </div>
            <p className="text-xs text-ash">
              {impact.blocked} duplicate{impact.blocked === 1 ? "" : "s"} blocked · {impact.held} held for approval ·{" "}
              {impact.runs} automated run{impact.runs === 1 ? "" : "s"} logged. These numbers come from the real engine,
              not a slideshow.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  resetAll();
                  window.location.reload();
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-ink/80 px-3 text-xs text-ink hover:bg-bone"
              >
                <RotateCcw className="size-3.5" /> Try again
              </button>
              <Link
                href="/dashboard"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-highlight px-3.5 text-xs text-ink hover:bg-[#d6e41a]"
              >
                See the team dashboard
              </Link>
              <Link
                href="/sandbox"
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-ink hover:bg-bone"
              >
                How the engine works
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-cl1ck className="font-sans" style={{ fontFeatureSettings: '"ss01"' }}>
      <div className="sticky top-0 z-[60] border-b border-hairline bg-paper text-ink">
        {open ? (
          <div className="space-y-2 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
              <div className="ml-auto flex items-center gap-1">
                {current.handsOn && !done.includes(step) && !busy && (
                  <>
                    <button
                      onClick={startHandsOn}
                      disabled={handsOn}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-ink/80 px-3 text-xs text-ink hover:bg-bone disabled:opacity-60"
                    >
                      I&apos;ll do it
                    </button>
                    <button
                      onClick={() => run(step)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-highlight px-3.5 text-xs text-ink hover:bg-[#d6e41a]"
                    >
                      <Play className="size-3.5" /> Do it for me
                    </button>
                  </>
                )}
                {(!current.handsOn || done.includes(step)) && (
                  <button
                    onClick={() => run(step)}
                    disabled={busy}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-highlight px-3.5 text-xs text-ink hover:bg-[#d6e41a] disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                    {busy ? "Running" : done.includes(step) ? "Replay" : "Play step"}
                  </button>
                )}
                {done.includes(STEPS.length - 1) && (
                  <button
                    onClick={() => setShowImpact(true)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-ink/80 px-3 text-xs text-ink hover:bg-bone"
                  >
                    See impact
                  </button>
                )}
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
            <div className="grid gap-2 sm:grid-cols-3">
              <CoachLine label="What to do" text={current.do} />
              <CoachLine label="What cl1ck is doing" text={current.watching} />
              <CoachLine label="Why it matters" text={current.why} />
            </div>
            {handsOn && step === 0 && (
              <ol className="flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-bone px-3 py-2 text-[11px] text-ink">
                <li>1. Open the Acme Roasting email</li>
                <li>2. Click New Bill</li>
                <li>3. Fill the seven fields from the invoice</li>
                <li>4. Click Post Bill</li>
              </ol>
            )}
            {result && done.includes(step) && (
              <div className="rounded-md border border-hairline bg-bone px-3 py-1.5 text-[11px] text-ink">
                <span className="text-ash">Result · </span>
                {result}
              </div>
            )}
          </div>
        ) : (
          <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-1 py-1 text-[11px] text-ash hover:text-ink">
            <ChevronDown className="size-3" /> Tour coach
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
            <path
              d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.5 L11 13 L18 13 Z"
              fill={cursor.actor === "Dana" ? "#0c0a08" : "#e4f222"}
              stroke={cursor.actor === "Dana" ? "#ffffff" : "#0c0a08"}
              strokeWidth="1.3"
            />
          </svg>
          <span
            className={cn(
              "absolute top-5 left-4 rounded-md px-1.5 py-0.5 text-[10px] whitespace-nowrap",
              cursor.actor === "Dana" ? "bg-ink text-paper" : "bg-highlight text-ink",
            )}
          >
            {cursor.actor === "Dana" ? "You (Dana)" : "cl1ck"}
          </span>
        </div>
      )}
    </div>
  );
}

function CoachLine({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-[10px] tracking-wide text-ash uppercase">{label}</div>
      <div className="mt-0.5 text-xs leading-snug text-ink">{text}</div>
    </div>
  );
}

function ImpactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-hairline bg-bone px-3 py-2">
      <div className="text-[10px] tracking-wide text-ash uppercase">{label}</div>
      <div className="mt-0.5 text-sm tabular-nums text-ink">{value}</div>
    </div>
  );
}
