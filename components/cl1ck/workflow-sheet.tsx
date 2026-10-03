"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, FlaskConical, Loader2, Wand2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DEFAULT_THRESHOLD,
  KEYS,
  NO_EDITS,
  NO_LEARNED,
  NO_SHARES,
  ruleYaml,
  setMode,
  shareWith,
  turnOffFor,
  turnOnFor,
  type LearnedLabels,
  type RuleEdits,
} from "@/lib/automation";
import { fmtDuration, fmtHours, fmtMoney0 } from "@/lib/format";
import { coveredBy, groupName, shareTargets } from "@/lib/groups";
import {
  BILL_FORM_FIELDS,
  BILL_WORKFLOW_ID,
  DEFAULT_ADOPTION,
  DEFAULT_MODES,
  GROUP_SIZES,
  MY_TEAM,
  SHARE_BACKTESTS,
  TEAM_SAMPLE_RUNS,
  VENDORS,
  WORKFLOW_STEPS,
  type PatternSummary,
} from "@/lib/seed";
import { useStored, write } from "@/lib/store";
import type { MergedRule, Mode } from "@/lib/types";
import { dryRun, useCl1ck } from "@/lib/use-cl1ck";
import { cn } from "@/lib/utils";
import { GhostButton, Label, Pill, PrimaryButton, SourceBadge, TextButton } from "./bits";

const MODES: { id: Mode; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "suggest", label: "Suggest" },
  { id: "ask", label: "Notify" },
  { id: "auto", label: "Auto" },
];

function ruleText(r: MergedRule) {
  if (r.kind === "extract") return `email · “${r.label}”`;
  if (r.kind === "lookup") return `by ${r.by}`;
  if (r.kind === "constant") return `always “${r.value}”`;
  return "ask";
}

export function WorkflowSheet({ pattern, group, onClose }: { pattern: PatternSummary | null; group: string; onClose: () => void }) {
  return (
    <Sheet open={!!pattern} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto border-hairline bg-paper p-0 text-ink data-[side=right]:sm:max-w-[760px]!"
      >
        {pattern &&
          (pattern.id === BILL_WORKFLOW_ID ? <BillWorkflow pattern={pattern} group={group} /> : <GenericWorkflow pattern={pattern} group={group} />)}
      </SheetContent>
    </Sheet>
  );
}

function Header({ pattern, group, line }: { pattern: PatternSummary; group: string; line: string }) {
  const adoption = useStored(KEYS.adoption, DEFAULT_ADOPTION);
  const covered = coveredBy(adoption, pattern.id, group);
  return (
    <SheetHeader className="gap-2 border-b border-hairline p-6 pr-12">
      <Label>{pattern.apps.join(" → ")}</Label>
      <SheetTitle className="text-[28px] leading-[1.14] font-normal text-ink">{pattern.name}</SheetTitle>
      <SheetDescription className="text-sm text-ash">{line}</SheetDescription>
      <div>{covered ? <Pill tone="emerald">Running · {groupName(covered)}</Pill> : <Pill>Not running</Pill>}</div>
    </SheetHeader>
  );
}

function Actions({ workflowId, group }: { workflowId: string; group: string }) {
  const adoption = useStored(KEYS.adoption, DEFAULT_ADOPTION);
  const modes = useStored(KEYS.modes, DEFAULT_MODES);
  const covered = coveredBy(adoption, workflowId, group);
  const mode = modes[workflowId] ?? "off";
  const name = groupName(group);
  const size = GROUP_SIZES[group] ?? 1;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {covered === group ? (
        <GhostButton
          onClick={() => {
            turnOffFor(workflowId, group);
            toast(`Off for ${name}`);
          }}
        >
          Turn off for {name}
        </GhostButton>
      ) : (
        <PrimaryButton
          onClick={() => {
            turnOnFor(workflowId, group, "auto");
            toast.success(`On for ${name}`, { description: `${size} ${size === 1 ? "person" : "people"}` });
          }}
        >
          Turn on for {group === "me" ? "me" : `${name} (${size})`}
        </PrimaryButton>
      )}
      {workflowId === BILL_WORKFLOW_ID && (
        <div className="inline-flex rounded-md border border-hairline p-0.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(workflowId, m.id)}
              className={cn(
                "rounded-[5px] px-2.5 py-1 text-xs transition-colors duration-300",
                mode === m.id ? "bg-ink text-paper" : "text-ash hover:text-ink",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Block({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-hairline px-6 py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Label>{title}</Label>
        {action}
      </div>
      {children}
    </section>
  );
}

function Figures({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-bone px-4 py-3">
          <Label>{label}</Label>
          <div className="mt-0.5 text-xl text-ink tabular-nums">{value}</div>
        </div>
      ))}
    </div>
  );
}

function BillWorkflow({ pattern, group }: { pattern: PatternSummary; group: string }) {
  const u = useCl1ck();
  const modes = useStored(KEYS.modes, DEFAULT_MODES);
  const decision = useStored<number | null>(KEYS.decision, null);
  const learned = useStored<LearnedLabels>(KEYS.learned, NO_LEARNED);
  const [dry, setDry] = useState<"idle" | "running" | "done">("idle");
  const limit = decision ?? DEFAULT_THRESHOLD;
  const results = dryRun(u.myRuns, u.rules);
  const yoursOk = results.filter((r) => r.ok).length;
  const yaml = ruleYaml(u.rules, modes[BILL_WORKFLOW_ID] ?? "off", {
    yours: u.myRuns.length,
    team: 212,
    dryRun: `team 24/25${results.length ? `, yours ${yoursOk}/${results.length}` : ""}`,
  });

  return (
    <div className="pb-10">
      <Header pattern={pattern} group={group} line={`Invoice email → bill in Ledgerline. Holds over ${fmtMoney0(limit)}.`} />
      <div className="space-y-5 px-6 py-5">
        <Actions workflowId={BILL_WORKFLOW_ID} group={group} />
        <Figures
          items={[
            ["Team runs / wk", "60"],
            ["By hand", fmtDuration(u.myMedian || pattern.medianSeconds)],
            ["Saves / wk", fmtHours(60 * pattern.medianSeconds)],
          ]}
        />
      </div>

      <Block
        title="How the team does it"
        action={
          <span
            className="text-[11px] text-ash"
            title="Side-by-side comparison of past runs. Matching fields across people is how cl1ck learns the shared rule (alignment)."
          >
            Alignment
          </span>
        }
      >
        <div className="overflow-x-auto rounded-xl border border-hairline">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-ash">
                <th className="px-3 py-2 font-normal">Run</th>
                {BILL_FORM_FIELDS.slice(0, 6).map((f) => (
                  <th key={f} className="px-3 py-2 font-normal whitespace-nowrap">
                    {f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {TEAM_SAMPLE_RUNS.map((r, i) => (
                <tr key={i} className="border-t border-hairline">
                  <td className="px-3 py-2 whitespace-nowrap text-ash">{r.who.replace("Teammate · ", "Team · ")}</td>
                  {r.values.slice(0, 6).map((v, j) => (
                    <td key={j} className={cn("px-3 py-2 whitespace-nowrap", j < 5 ? "text-ink" : "text-ash")}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
              {u.myRuns.map((ep, i) => (
                <tr key={ep.id} className="border-t border-hairline bg-bone">
                  <td className="px-3 py-2 whitespace-nowrap text-ink">You · {i + 1}</td>
                  {BILL_FORM_FIELDS.slice(0, 6).map((f) => {
                    const v = ep.fields[f];
                    return (
                      <td key={f} className={cn("px-3 py-2 whitespace-nowrap", v?.trace ? "text-ink underline decoration-highlight decoration-2 underline-offset-4" : "text-ash")}>
                        {v ? v.value.replace(/^V-\d+ · /, "").replace(/ · .*$/, "") : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t border-ink/20">
                <td className="px-3 py-2 text-ink">Learned</td>
                {u.rules.slice(0, 6).map((r) => (
                  <td key={r.field} className="px-3 py-2 whitespace-nowrap text-ink">
                    {ruleText(r)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-ash">Underlined = traced back to the email.</p>
      </Block>

      <Block title="What it learned">
        <div className="divide-y divide-hairline">
          {u.rules.map((r) => (
            <div key={r.field} className="flex items-center gap-3 py-2 text-xs">
              <span className="w-24 shrink-0 text-ash">{r.field}</span>
              <ArrowRight className="size-3 shrink-0 text-smoke" />
              <span className="flex-1 text-ink">{ruleText(r)}</span>
              <SourceBadge source={r.source} />
            </div>
          ))}
        </div>
        {Object.entries(learned).map(([vendorId, labels]) => (
          <div key={vendorId} className="mt-3 rounded-xl bg-bone p-3 text-xs">
            <div className="mb-1 text-ink">{VENDORS.find((v) => v.id === vendorId)?.name ?? vendorId} · read by Claude once</div>
            {Object.entries(labels).map(([field, label]) => (
              <div key={field} className="flex gap-2 text-ash">
                <span className="w-24 shrink-0">{field}</span>“{label}”
              </div>
            ))}
          </div>
        ))}
      </Block>

      <Block title="Edit with Claude">
        <NlEdit threshold={limit} />
      </Block>

      <Block title="Guardrails">
        <div className="space-y-1.5 text-xs text-ink">
          <div className="flex items-center gap-2">
            Hold over
            {[5000, 2500].map((amt) => (
              <button
                key={amt}
                onClick={() => {
                  write(KEYS.decision, amt);
                  toast.success(`Team rule: hold over ${fmtMoney0(amt)}`);
                }}
                className={cn(
                  "rounded-md border px-2 py-0.5 transition-colors duration-300",
                  limit === amt ? "border-ink bg-ink text-paper" : "border-hairline text-ash hover:text-ink",
                )}
              >
                {fmtMoney0(amt)}
              </button>
            ))}
            <span className="text-ash">· 3 people use $5k, 1 uses $2.5k</span>
          </div>
          <div>Block duplicate invoices</div>
          <div>Pause above 3× the vendor&apos;s average</div>
          <div className="text-ash">Never edits bank details · capped to owner&apos;s permissions</div>
        </div>
      </Block>

      <Block
        title="Dry run"
        action={
          <TextButton
            onClick={() => {
              setDry("running");
              window.setTimeout(() => setDry("done"), 900);
            }}
          >
            <FlaskConical className="size-3.5" /> Run
          </TextButton>
        }
      >
        {dry === "running" && <div className="h-1 w-full animate-pulse rounded-full bg-highlight" />}
        {dry !== "running" && (
          <div className="space-y-2 text-xs">
            <div className="flex gap-6">
              <span className="text-ash">
                Team <span className="text-ink tabular-nums">24/25</span>
              </span>
              {dry === "done" && (
                <span className="text-ash">
                  Yours{" "}
                  <span className="text-ink tabular-nums">
                    {yoursOk}/{results.length}
                  </span>
                </span>
              )}
            </div>
            {dry === "done" &&
              results.map((r, i) => (
                <div key={r.episode.id} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-12 text-ash">Run {i + 1}</span>
                  {r.checks.map((c) => (
                    <span
                      key={c.field}
                      title={`You: ${c.yours}\nWorkflow: ${c.auto || "(blank)"}`}
                      className={cn(
                        "rounded-md px-1.5 py-0.5",
                        c.match === null ? "bg-bone text-ash" : c.match ? "bg-ink text-paper" : "border border-ink text-ink",
                      )}
                    >
                      {c.match === null ? "○" : c.match ? "✓" : "✗"} {c.field}
                    </span>
                  ))}
                </div>
              ))}
          </div>
        )}
      </Block>

      <ShareBlock />

      <Block title="Rule">
        <details>
          <summary className="cursor-pointer text-xs text-ash hover:text-ink">trigger → conditions → actions</summary>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-obsidian p-4 font-mono text-[11px] leading-relaxed text-paper">{yaml}</pre>
        </details>
      </Block>
    </div>
  );
}

const EXAMPLES = ["Hold anything from Highland over $3,000", "Memo = invoice number, then vendor", "Tell Maria when a bill is over $5k"];

// Claude turns a sentence into a structured rule change (a few cents per edit).
function NlEdit({ threshold }: { threshold: number }) {
  const edits = useStored<RuleEdits>(KEYS.edits, NO_EDITS);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [unsupported, setUnsupported] = useState<string[]>([]);

  const apply = async (instruction: string) => {
    setBusy(true);
    setUnsupported([]);
    try {
      const res = await fetch("/api/nl-edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction, threshold, vendors: VENDORS.map((v) => v.name) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      const e = data.edit as RuleEdits & { threshold: number | null; unsupported: string[] };
      if (e.threshold) write(KEYS.decision, e.threshold);
      write<RuleEdits>(KEYS.edits, {
        summary: e.summary,
        vendorHolds: [...edits.vendorHolds.filter((h) => !e.vendorHolds.some((n) => n.vendor === h.vendor)), ...e.vendorHolds],
        memoTemplate: e.memoTemplate ?? edits.memoTemplate,
        notify: [...edits.notify, ...e.notify],
      });
      setUnsupported(e.unsupported);
      setText("");
      toast.success("Rule updated", { description: e.summary });
    } catch (err) {
      toast.error("Couldn't apply that", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const hasEdits = edits.vendorHolds.length || edits.memoTemplate || edits.notify.length;
  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (text.trim()) apply(text.trim());
        }}
      >
        <input
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          placeholder="Hold anything from Highland over $3,000"
          className="h-8 flex-1 rounded-[10px] border border-[rgba(33,33,33,0.1)] bg-paper px-3 text-xs text-ink outline-none placeholder:text-ash focus:border-ink"
        />
        <PrimaryButton type="submit" disabled={busy || !text.trim()}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />} Apply
        </PrimaryButton>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            disabled={busy}
            onClick={() => apply(ex)}
            className="rounded-md bg-bone px-2 py-1 text-[11px] text-ash transition-colors duration-300 hover:text-ink"
          >
            {ex}
          </button>
        ))}
      </div>
      {hasEdits ? (
        <div className="mt-3 space-y-0.5 text-xs text-ink">
          {edits.vendorHolds.map((h) => (
            <div key={h.vendor}>· Hold {h.vendor} over {fmtMoney0(h.amount)}</div>
          ))}
          {edits.memoTemplate && <div>· Memo: {edits.memoTemplate}</div>}
          {edits.notify.map((n, i) => (
            <div key={i}>
              · Notify {n.who} {n.when}
            </div>
          ))}
          <button className="text-[11px] text-ash underline hover:text-ink" onClick={() => write(KEYS.edits, NO_EDITS)}>
            Undo edits
          </button>
        </div>
      ) : null}
      {unsupported.length > 0 && <p className="mt-2 text-xs text-ash">Not supported: {unsupported.join("; ")}</p>}
    </div>
  );
}

function ShareBlock() {
  const shares = useStored(KEYS.shares, NO_SHARES);
  const targets = shareTargets(MY_TEAM);
  const order = ["finance", "ar", "fpa", "ops", "eng"];
  const rows = order.map((id) => targets.find((t) => t.node.id === id)!).filter(Boolean);
  return (
    <Block title="Share · one step">
      <div className="grid gap-2 sm:grid-cols-5">
        {rows.map(({ node, rel }) => {
          const s = shares[node.id];
          const bt = SHARE_BACKTESTS[node.id];
          return (
            <button
              key={node.id}
              disabled={!rel || !!s}
              onClick={() => {
                shareWith(node.id);
                toast(`Shared with ${node.name}`);
              }}
              className={cn(
                "rounded-xl border p-3 text-left text-xs transition-colors duration-300",
                s?.status === "adopted" ? "border-ink" : rel ? "border-hairline hover:border-ink" : "cursor-not-allowed border-hairline opacity-40",
              )}
            >
              <div className="text-ink">{node.name}</div>
              <div className="mt-0.5 text-[11px] text-ash">
                {!rel && "2+ steps"}
                {rel && !s && { up: "↑ up", down: "↓ down", beside: "↔ beside" }[rel]}
                {s?.status === "sent" && "Sent"}
                {s?.status === "backtesting" && "Dry-running…"}
                {s?.status === "adopted" && (bt ? `${bt.matched}/${bt.total} · adopted` : "Visible")}
              </div>
            </button>
          );
        })}
      </div>
    </Block>
  );
}

function GenericWorkflow({ pattern, group }: { pattern: PatternSummary; group: string }) {
  const steps = WORKFLOW_STEPS[pattern.id] ?? [];
  return (
    <div className="pb-10">
      <Header pattern={pattern} group={group} line={pattern.teams ? `Found in ${pattern.teams.join(", ")}.` : `${pattern.people ?? "Your team"}.`} />
      <div className="space-y-5 px-6 py-5">
        <Actions workflowId={pattern.id} group={group} />
        <Figures
          items={[
            ["Runs / wk", String(pattern.runsPerWeek)],
            ["By hand", fmtDuration(pattern.medianSeconds)],
            ["Saves / wk", fmtHours(pattern.runsPerWeek * pattern.medianSeconds)],
          ]}
        />
      </div>
      <Block title="Steps">
        <ol className="flex flex-wrap items-center gap-2 text-xs">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className="rounded-md bg-bone px-2.5 py-1.5 text-ink">{s}</span>
              {i < steps.length - 1 && <ArrowRight className="size-3 text-smoke" />}
            </li>
          ))}
        </ol>
      </Block>
    </div>
  );
}
