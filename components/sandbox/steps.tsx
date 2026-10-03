"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Minus, X } from "lucide-react";
import { fmtMoney, fmtMoney0 } from "@/lib/format";
import { MY_TEAM, ORG_TREE, TEAM_MEMBERS, relation, type OrgNode } from "@/lib/seed";
import { formatFor } from "@/lib/trace";
import type { CapturedEvent, FieldRule, MergedRule } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, Label, Pill, SourceBadge } from "@/components/cl1ck/bits";
import type { Sandbox } from "@/lib/sandbox";

// Counts 0 → max on an interval, restarting whenever the step remounts.
function useTicker(max: number, ms: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setN((v) => (v >= max ? v : v + 1)), ms);
    return () => window.clearInterval(t);
  }, [max, ms]);
  return n;
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-hairline bg-paper p-5", className)}>{children}</div>;
}

const clock = (ts: number) => new Date(ts).toISOString().slice(11, 19);
const short = (v: string) => v.replace(/^V-\d+ · /, "").replace(/^(\d{4}) · .*$/, "$1");

function EmailDoc({ lines, active, compact }: { lines: string[]; active?: number; compact?: boolean }) {
  return (
    <div className={cn("space-y-0.5 text-xs", compact && "max-h-[340px] overflow-hidden")}>
      {lines.map((l, i) => (
        <div
          key={i}
          className={cn(
            "truncate rounded-md px-1.5 py-0.5 transition-colors duration-300",
            i === 0 ? "text-sm text-ink" : "text-ash",
            active === i && "bg-highlight text-ink",
          )}
        >
          {l}
        </div>
      ))}
    </div>
  );
}

function eventLine(e: CapturedEvent) {
  switch (e.type) {
    case "change":
      return `change   ${e.label} = "${short(e.value ?? "")}"`;
    case "view":
      return `view     ${e.snapshot?.tokens.length ?? 0} values on screen`;
    case "click":
      return `click    ${e.label}`;
    case "copy":
      return `copy     "${e.value}"`;
    case "submit":
      return `submit   ${e.label}`;
    default:
      return `${e.type.padEnd(8)} ${e.route}`;
  }
}

// 1 — Capture
export function CaptureStep({ s }: { s: Sandbox }) {
  const session = s.sessions[0];
  const n = useTicker(session.events.length, 520);
  const shown = session.events.slice(0, n);
  const filled = new Map(shown.filter((e) => e.type === "change").map((e) => [e.label!, e.value!]));
  const current = shown[shown.length - 1];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.2fr]">
      <Card>
        <Label className="mb-2">Inbox · email</Label>
        <EmailDoc lines={session.lines.slice(0, 18)} compact />
      </Card>
      <Card>
        <Label className="mb-2">Ledgerline · new bill</Label>
        <div className="space-y-2">
          {session.fills.map((f) => {
            const v = filled.get(f.label);
            const live = current?.type === "change" && current.label === f.label;
            return (
              <div key={f.label} className="grid grid-cols-[96px_1fr] items-center gap-2 text-xs">
                <span className="text-ash">{f.label}</span>
                <span
                  className={cn(
                    "h-7 truncate rounded-[10px] border px-2.5 leading-7 transition-colors duration-300",
                    live ? "border-ink bg-highlight text-ink" : v ? "border-hairline text-ink" : "border-hairline text-smoke",
                  )}
                >
                  {v ? short(v) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
      <div className="rounded-2xl bg-obsidian p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="us-label">Event stream</span>
          <span className="flex items-center gap-1.5 text-[11px] text-paper tabular-nums">
            <span className="size-1.5 rounded-[2px] bg-highlight" /> {n} events
          </span>
        </div>
        <div className="flex h-[300px] flex-col justify-end overflow-hidden font-mono text-[11px] leading-6 text-paper/80">
          {shown.slice(-12).map((e) => (
            <div key={e.id} className="truncate">
              <span className="text-ash">{clock(e.ts)}</span> {eventLine(e)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 2 — Trace
export function TraceStep({ s }: { s: Sandbox }) {
  const session = s.sessions[0];
  const n = useTicker(session.fills.length, 1100);
  const active = session.fills[Math.min(n, session.fills.length - 1)];
  const lineOf = (label?: string) =>
    label ? session.lines.findIndex((l) => l.toLowerCase().startsWith(label.toLowerCase())) : -1;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <Label className="mb-2">Email the values came from</Label>
        <EmailDoc lines={session.lines.slice(0, 18)} active={lineOf(active.trace?.label)} />
      </Card>
      <Card>
        <Label className="mb-3">Typed field ← label on the email</Label>
        <div className="space-y-1.5">
          {session.fills.map((f, i) => (
            <div
              key={f.label}
              className={cn(
                "grid grid-cols-[96px_16px_1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors duration-300",
                i === Math.min(n, session.fills.length - 1) ? "bg-highlight" : i < n ? "bg-bone" : "",
              )}
            >
              <span className="text-ink">{f.label}</span>
              <ArrowLeft className="size-3 text-ash" />
              <span className={f.trace ? "text-ink" : "text-ash"}>{f.trace ? `“${f.trace.label}”` : "typed by hand"}</span>
              <span className="truncate text-ash tabular-nums">{short(f.value)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// 3 — Group
export function GroupStep({ s }: { s: Sandbox }) {
  const [a, b] = s.episodes;
  const n = useTicker(Math.max(a.tokens.length, b.tokens.length), 140);
  const row = (tokens: string[], other: string[]) => (
    <div className="flex flex-wrap gap-1.5">
      {tokens.slice(0, n).map((t, i) => (
        <span
          key={i}
          className={cn("rounded-md px-1.5 py-0.5 text-[11px]", other.includes(t) ? "bg-bone text-ink" : "border border-ink text-ink")}
        >
          {t}
        </span>
      ))}
    </div>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
      <Card className="space-y-4">
        <div>
          <Label className="mb-2">Task 1 · {a.sourceTitle}</Label>
          {row(a.tokens, b.tokens)}
        </div>
        <div>
          <Label className="mb-2">Task 2 · {b.sourceTitle}</Label>
          {row(b.tokens, a.tokens)}
        </div>
        <p className="text-xs text-ash">Outlined steps differ. Edit distance tolerates them.</p>
      </Card>
      <Card className="flex flex-col justify-between">
        <div>
          <Label>Alignment similarity</Label>
          <div className="mt-1 flex items-center gap-2">
            <span className="size-2 rounded-[2px] bg-highlight" />
            <span className="text-[40px] leading-[1.05] text-ink tabular-nums">{Math.round(s.similarity * 100)}%</span>
          </div>
          <div className="text-xs text-ash">threshold 50%</div>
        </div>
        <div className="mt-6 space-y-1 text-xs text-ink">
          <div>
            {s.clusters} pattern · {s.episodes.length} runs
          </div>
          <div className="text-ash">form: {a.form}</div>
        </div>
      </Card>
    </div>
  );
}

function ruleText(r?: FieldRule) {
  if (!r) return "—";
  if (r.kind === "extract") return `copy “${r.label}”`;
  if (r.kind === "lookup") return `by ${r.by}`;
  if (r.kind === "constant") return `always “${r.value}”`;
  return "ask";
}

// 4 — Learn
export function LearnStep({ s }: { s: Sandbox }) {
  const n = useTicker(s.merged.length, 260);
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-hairline text-left">
            {["Field", "Your 2 runs", "Team · 212 runs", "Used"].map((h) => (
              <th key={h} className="px-5 py-3 font-normal">
                <span className="us-label">{h}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.merged.slice(0, n).map((m: MergedRule) => {
            const mine = s.personal.find((r) => r.field === m.field);
            const strong = mine && mine.support > 0;
            return (
              <tr key={m.field} className="border-b border-hairline last:border-0">
                <td className="px-5 py-2.5 text-ink">{m.field}</td>
                <td className="px-5 py-2.5">
                  <span className={strong ? "text-ink" : "text-ash"}>{ruleText(mine)}</span>
                  <span className="ml-2 text-ash tabular-nums">{mine ? `${mine.support}/${mine.total}` : ""}</span>
                </td>
                <td className="px-5 py-2.5 text-ink">
                  {ruleText(m.source === "you" ? undefined : m)}
                  {m.teamTotal ? <span className="ml-2 text-ash tabular-nums">{`${m.teamSupport}/${m.teamTotal}`}</span> : null}
                </td>
                <td className="px-5 py-2.5">
                  <SourceBadge source={m.source} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// 5 — Dry run
export function DryRunStep({ s }: { s: Sandbox }) {
  const total = s.dryRun.reduce((x, r) => x + r.checks.length, 0);
  const n = useTicker(total, 160);
  const offsets = s.dryRun.map((_, i) => s.dryRun.slice(0, i).reduce((x, r) => x + r.checks.length, 0));
  const scored = s.dryRun.flatMap((r) => r.checks.filter((c) => c.match !== null));
  const matched = scored.filter((c) => c.match).length;
  const runsOk = s.dryRun.filter((r) => r.checks.every((c) => c.match !== false)).length;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
      <Card className="space-y-4">
        {s.dryRun.map((r, i) => (
          <div key={r.episode.id}>
            <Label className="mb-2">
              Run {i + 1} · {r.email.invoice?.number}
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {r.checks.map((c, j) => {
                const on = offsets[i] + j < n;
                return (
                  <span
                    key={c.field}
                    title={`typed: ${c.typed}\nworkflow: ${c.auto || "(blank)"}`}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors duration-300",
                      !on ? "bg-bone text-smoke" : c.match === null ? "bg-bone text-ash" : c.match ? "bg-ink text-paper" : "border border-ink text-ink",
                    )}
                  >
                    {on && (c.match === null ? <Minus className="size-3" /> : c.match ? <Check className="size-3" /> : <X className="size-3" />)}
                    {c.field}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        <p className="text-xs text-ash">Memo is free text you write yourself, so it isn&apos;t scored.</p>
      </Card>
      <Card>
        <Label>Agreement</Label>
        <div className="mt-1 flex items-center gap-2">
          <span className="size-2 rounded-[2px] bg-highlight" />
          <span className="text-[40px] leading-[1.05] text-ink tabular-nums">
            {scored.length ? Math.round((matched / scored.length) * 100) : 0}%
          </span>
        </div>
        <div className="mt-1 text-xs text-ash tabular-nums">
          {runsOk}/{s.dryRun.length} runs · {matched}/{scored.length} fields · needs ≥ 90%
        </div>
      </Card>
    </div>
  );
}

// 6 — Guardrails
export function GuardrailStep({ s }: { s: Sandbox }) {
  const n = useTicker(s.outcomes.length, 900);
  const protectedTotal = s.outcomes.slice(0, n).reduce((x, o) => x + o.protectedAmount, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {s.outcomes.map((o, i) => (
          <Card key={o.email.id} className={cn("transition-colors duration-300", i >= n && "opacity-40")}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ash">{o.email.from}</span>
              {i < n && (
                <Pill tone={o.status === "Posted" ? "emerald" : o.status === "Held" ? "amber" : "red"}>{o.status}</Pill>
              )}
            </div>
            <div className="mt-2 text-[24px] leading-[1.17] text-ink tabular-nums">{fmtMoney(o.amount)}</div>
            <div className="text-xs text-ash">{o.email.invoice?.number}</div>
            <div className="mt-3 space-y-1 text-xs text-ink">
              {i < n && (o.flags.length ? o.flags.map((f) => <div key={f}>{f}</div>) : <div className="text-ash">No flags</div>)}
            </div>
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-ash">
        <span className="size-2 rounded-[2px] bg-highlight" />
        Protected <span className="text-ink tabular-nums">{fmtMoney0(protectedTotal)}</span> · duplicate blocked + early-pay discount found
      </div>
    </div>
  );
}

function OrgRow({ node, depth }: { node: OrgNode; depth: number }) {
  const rel = relation(MY_TEAM, node.id);
  const mine = node.id === MY_TEAM;
  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs",
          mine ? "bg-highlight text-ink" : rel ? "bg-bone text-ink" : "text-smoke",
        )}
        style={{ marginLeft: depth * 16 }}
      >
        <span>{node.name}</span>
        <span className="text-[11px]">
          {mine ? "on · 4 people" : rel ? { up: "↑ share up", down: "↓ share down", beside: "↔ share beside" }[rel] : "2+ steps"}
        </span>
      </div>
      {node.children?.map((c) => (
        <OrgRow key={c.id} node={c} depth={depth + 1} />
      ))}
    </>
  );
}

// 7 — Team & org
export function TeamStep() {
  const n = useTicker(TEAM_MEMBERS.length, 450);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="space-y-1">
        <Label className="mb-2">Juniper Coffee Roasters · org ceiling</Label>
        <OrgRow node={ORG_TREE} depth={0} />
      </Card>
      <Card>
        <Label className="mb-3">Accounts Payable</Label>
        <div className="space-y-2.5">
          {TEAM_MEMBERS.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 text-xs">
              <Avatar initials={m.initials} you={m.you} />
              <span className="flex-1 text-ink">{m.name}</span>
              {i < n ? <Pill tone="emerald">On</Pill> : <Pill>Manual</Pill>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// 8 — Unfamiliar layout, read once by Claude
export function ClaudeStep({ s }: { s: Sandbox }) {
  const u = s.unfamiliar;
  const n = useTicker(3, 1200);
  const keyLines = u.lines.filter((l) => u.learned.some((x) => l.startsWith(x.label)) || l === u.lines[0]);
  const shape = (f: string) => (f.includes("Date") ? "date" : f === "Amount" ? "currency" : "text");
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <Label className="mb-2">New vendor, new labels</Label>
        <EmailDoc lines={keyLines} />
        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-ash">Rules missed:</span>
          {u.missing.map((m) => (
            <span key={m} className="rounded-md border border-ink px-1.5 py-0.5 text-[11px] text-ink">
              {m}
            </span>
          ))}
        </div>
      </Card>
      <Card className={cn("transition-colors duration-300", n < 1 && "opacity-40")}>
        <div className="mb-3 flex items-center justify-between">
          <Label>Claude reads it once</Label>
          <Pill tone={n >= 1 ? "emerald" : "zinc"}>{n >= 1 ? "Learned" : "Needs read"}</Pill>
        </div>
        <div className="space-y-1.5">
          {u.learned.map((l) => (
            <div key={l.field} className="grid grid-cols-[88px_1fr] gap-2 text-xs">
              <span className="text-ash">{l.field}</span>
              <span className="truncate text-ink">“{l.label}”</span>
            </div>
          ))}
        </div>
        <div className="mt-4 text-[11px] text-ash">Illustrated here. Live demo calls Claude (~$0.007).</div>
      </Card>
      <Card className={cn("transition-colors duration-300", n < 2 && "opacity-40")}>
        <div className="mb-3 flex items-center justify-between">
          <Label>Next invoice · {u.next.email.invoice?.number}</Label>
          <Pill tone={n >= 2 ? "emerald" : "zinc"}>$0.00</Pill>
        </div>
        <div className="space-y-1.5">
          {u.learned.map((l) => {
            const p = u.next.proposal[l.field];
            return (
              <div key={l.field} className="grid grid-cols-[88px_1fr] gap-2 text-xs">
                <span className="text-ash">{l.field}</span>
                <span className="truncate text-ink tabular-nums">{p ? short(formatFor(shape(l.field), p.value).split(",")[0]) : "—"}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-[11px] text-ash">
          {u.next.filled.length}/{u.learned.length} fields by the free extractor
        </div>
      </Card>
    </div>
  );
}
