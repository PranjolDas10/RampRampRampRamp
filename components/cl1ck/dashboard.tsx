"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpRight, Inbox, Play, RotateCcw } from "lucide-react";
import { KEYS, NO_RUNS, QUEUE_IDS, loadSampleSession, readWithClaude, receiveNextEmail, turnOnFor } from "@/lib/automation";
import { fmtDuration, fmtHours, fmtMoney, fmtMoney0, HOURLY_RATE } from "@/lib/format";
import { coveredBy, groupName } from "@/lib/groups";
import {
  BILL_WORKFLOW_ID,
  DEFAULT_ADOPTION,
  FINANCE_PATTERNS,
  LAYERS,
  LAYER_GROUP,
  ORG_PATTERNS,
  TEAM_PATTERNS,
  type LayerId,
  type PatternSummary,
} from "@/lib/seed";
import { resetAll, useStored } from "@/lib/store";
import type { Run } from "@/lib/types";
import { DISCOVERY_THRESHOLD, useNow, useCl1ck } from "@/lib/use-cl1ck";
import { cn } from "@/lib/utils";
import { GhostButton, Label, Pill, PrimaryButton, Stat, TextButton, useCountUp } from "./bits";
import { AuditLog, LiveFeed, OrgMap, PersonalSetups, TeamMembers } from "./panels";
import { UseCases } from "./use-cases";
import { WorkflowSheet } from "./workflow-sheet";

const LAYER_LINE: Record<LayerId, string> = {
  me: "Your repeats, matched to your team's workflows.",
  ap: "Everyone's repeated work, merged into shared automations.",
  finance: "Patterns across AP, AR and FP&A.",
  org: "Only templates reach this layer. Nothing leaves the org.",
};

export function TopNav({ active, onUseCases }: { active: "workflows" | "personal" | "sandbox" | "usecases"; onUseCases?: () => void }) {
  const tab = (on: boolean) =>
    cn("rounded-md px-3 py-1.5 text-sm transition-colors duration-300", on ? "bg-bone text-ink" : "text-ash hover:text-ink");
  return (
    <div className="flex items-center gap-6">
      <Link href="/" className="flex items-center gap-2 text-ink">
        <span className="flex size-6 items-center justify-center rounded-md bg-ink text-[13px] text-highlight">1</span>
        cl1ck
      </Link>
      <nav className="hidden items-center gap-1 md:flex">
        <Link href="/" className={tab(active === "workflows")}>
          Workflows
        </Link>
        <Link href="/personal" className={tab(active === "personal")}>
          Personal
        </Link>
        <Link href="/sandbox" className={tab(active === "sandbox")}>
          Sandbox
        </Link>
        {onUseCases ? (
          <button onClick={onUseCases} className={tab(active === "usecases")}>
            Use cases
          </button>
        ) : (
          <Link href="/" className={tab(false)}>
            Use cases
          </Link>
        )}
      </nav>
    </div>
  );
}

export function Dashboard() {
  const [layer, setLayer] = useState<LayerId>("ap");
  const [page, setPage] = useState<"overview" | "usecases">("overview");
  const [open, setOpen] = useState<PatternSummary | null>(null);
  const u = useCl1ck();
  const now = useNow(4000);
  const runs = useStored<Run[]>(KEYS.runs, NO_RUNS);
  const queue = useStored<string[]>(KEYS.queue, QUEUE_IDS);
  const group = LAYER_GROUP[layer];

  const live = runs.filter((r) => r.status !== "Undone");
  const savedAnim = useCountUp(live.reduce((s, r) => s + r.seconds, 0));
  const protectedAnim = useCountUp(live.reduce((s, r) => s + r.protected, 0));

  const mePatterns: PatternSummary[] = [
    {
      ...TEAM_PATTERNS[0],
      runsPerWeek: 15,
      medianSeconds: u.myMedian || 250,
      people: u.myRuns.length ? `You · ${u.myRuns.length} today` : "Your team does this",
      status: u.discovered ? "detected" : u.myRuns.length ? "forming" : "suggested",
      progress: [u.myRuns.length, DISCOVERY_THRESHOLD],
      note: undefined,
    },
    { ...TEAM_PATTERNS[1], runsPerWeek: 35, people: "From your team" },
  ];
  const patterns =
    layer === "me"
      ? mePatterns
      : layer === "ap"
        ? TEAM_PATTERNS.map((p) => ({ ...p, note: undefined, people: p.id === BILL_WORKFLOW_ID && u.discovered ? "4 of 4 people · incl. you" : p.people }))
        : layer === "finance"
          ? FINANCE_PATTERNS
          : ORG_PATTERNS;
  const weekly = patterns.filter((p) => p.status !== "forming").reduce((s, p) => s + p.runsPerWeek * p.medianSeconds, 0);

  const simulate = () => {
    const { email, run } = receiveNextEmail(u.rules, u.manualSeconds);
    if (!email) return;
    if (run?.status === "Needs read") {
      const id = toast.loading(`New layout from ${email.from}`, { description: "Claude is reading it once…" });
      readWithClaude(run.id, u.rules, u.manualSeconds).then((done) => {
        if (done && done.status !== "Needs read") {
          toast.success(`${done.status}: ${done.invoiceNo}`, {
            id,
            description: done.flags.find((f) => f.startsWith("Read by Claude")) ?? done.flags[0],
          });
        } else {
          toast.error("Couldn't read it", { id, description: "Left for a person." });
        }
      });
      return;
    }
    if (run) toast.success(`${run.status}: ${run.invoiceNo}`, { description: run.flags[0] ?? fmtMoney(run.amount) });
    else toast(`New invoice from ${email.from}`, { description: "Workflow is off, waiting for a person." });
  };

  return (
    <div className="min-h-screen bg-bone text-ink">
      <header className="sticky top-0 z-30 border-b border-hairline bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-6 py-3">
          <TopNav active={page === "usecases" ? "usecases" : "workflows"} onUseCases={() => setPage(page === "usecases" ? "overview" : "usecases")} />
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-2 text-xs text-ash sm:flex">
              <span className="size-2 animate-pulse rounded-[2px] bg-highlight" />
              <span className="tabular-nums text-ink">{u.events.length}</span> events
            </span>
            <a
              href="/ledgerline"
              target="ledgerline"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-ink/80 px-3 text-xs text-ink hover:bg-bone"
            >
              Ledgerline <ArrowUpRight className="size-3.5" />
            </a>
            <TextButton
              aria-label="Reset demo"
              onClick={() => {
                resetAll();
                toast("Demo reset");
              }}
            >
              <RotateCcw className="size-3.5" />
            </TextButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] space-y-6 px-6 py-8">
        {page === "usecases" ? (
          <UseCases />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1">
              {LAYERS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLayer(l.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs transition-colors duration-300",
                    layer === l.id ? "bg-ink text-paper" : "text-ash hover:bg-paper hover:text-ink",
                  )}
                >
                  {l.name}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-[40px] leading-[1.05] text-ink">{layer === "me" ? "Your work" : LAYERS.find((l) => l.id === layer)!.name}</h1>
                <p className="mt-2 text-base text-ash">{LAYER_LINE[layer]}</p>
              </div>
              <div className="flex gap-2">
                {!u.myRuns.length && (
                  <GhostButton
                    onClick={() => {
                      loadSampleSession();
                      toast("Sample session loaded");
                    }}
                  >
                    <Play className="size-3.5" /> Sample session
                  </GhostButton>
                )}
                <GhostButton disabled={!queue.length} onClick={simulate}>
                  <Inbox className="size-3.5" /> Incoming invoice {queue.length ? `(${queue.length})` : ""}
                </GhostButton>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Repeated work" value={`${fmtHours(weekly)}/wk`} />
              <Stat label="Yearly value" value={fmtMoney0((weekly / 3600) * 52 * HOURLY_RATE)} />
              <Stat label="Saved today" value={fmtDuration(savedAnim)} accent />
              <Stat label="Money protected" value={fmtMoney0(protectedAnim)} accent />
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-8">
                <PatternList patterns={patterns} group={group} onOpen={setOpen} />
                {layer === "ap" && <PersonalSetups />}
                {(layer === "finance" || layer === "org") && <OrgMap highlight={group} />}
                <AuditLog runs={runs} now={now} />
              </div>
              <div className="space-y-6 lg:col-span-4">
                {(layer === "ap" || layer === "me") && <TeamMembers myRuns={u.myRuns.length} myMedian={u.myMedian} />}
                <LiveFeed events={u.events} now={now} />
              </div>
            </div>
          </>
        )}
      </main>
      <WorkflowSheet pattern={open} group={group} onClose={() => setOpen(null)} />
    </div>
  );
}

function PatternList({
  patterns,
  group,
  onOpen,
}: {
  patterns: PatternSummary[];
  group: string;
  onOpen: (p: PatternSummary) => void;
}) {
  const adoption = useStored(KEYS.adoption, DEFAULT_ADOPTION);
  const sorted = [...patterns].sort((a, b) => b.runsPerWeek * b.medianSeconds - a.runsPerWeek * a.medianSeconds);
  return (
    <section className="rounded-2xl border border-hairline bg-paper">
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <h3 className="text-base text-ink">Workflows</h3>
        <Label>Ranked by time saved</Label>
      </div>
      <div className="divide-y divide-hairline">
        {sorted.map((p, i) => {
          const covered = coveredBy(adoption, p.id, group);
          const TurnOn = i === 0 ? PrimaryButton : GhostButton;
          return (
            <div key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(p)}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ink hover:underline">{p.name}</span>
                  {p.status === "forming" && p.progress && (
                    <Pill tone="amber">
                      Forming {p.progress[0]}/{p.progress[1]}
                    </Pill>
                  )}
                  {covered && <Pill tone="emerald">Running · {groupName(covered)}</Pill>}
                </div>
                <div className="mt-1 text-xs text-ash">
                  {p.apps.join(" → ")} · {p.people ?? p.teams?.join(", ")}
                </div>
              </button>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-ink tabular-nums">{fmtHours(p.runsPerWeek * p.medianSeconds)}/wk</div>
                  <div className="text-[11px] text-ash">
                    {p.runsPerWeek}× · {fmtDuration(p.medianSeconds)}
                  </div>
                </div>
                {covered || p.status === "forming" ? (
                  <GhostButton onClick={() => onOpen(p)}>{covered ? "Review" : "Details"}</GhostButton>
                ) : (
                  <TurnOn
                    onClick={() => {
                      turnOnFor(p.id, group, "auto");
                      toast.success(`On for ${groupName(group)}`, { description: p.name });
                    }}
                  >
                    Turn on for {group === "me" ? "me" : groupName(group)}
                  </TurnOn>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
